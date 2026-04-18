// core/scene/SceneManager.ts
import * as THREE from 'three';
import { EventEmitter } from 'events';
import {
  SceneData,
  AnySceneObject,
  SceneChange,
  SceneSnapshot,
  ComponentInstance,
  Transform,
  ObjectType,
  PrimitiveType,
  LightType
} from './types';

// Типы для сетевого взаимодействия
export interface SceneUser {
  id: string;
  name: string;
  color: string;
  sessionType: 'editor' | 'vr';
  controllerState?: {
    position: [number, number, number];
    rotation: [number, number, number];
    buttons: Record<string, boolean>;
  };
}

export interface SceneSession {
  id: string;
  sceneId: string;
  users: Map<string, SceneUser>;
  createdAt: number;
  lastActivity: number;
}

export interface NetworkMessage {
  type: 'auth' | 'scene:join' | 'scene:leave' | 'scene:change' | 'scene:sync' |
    'scene:request-sync' | 'user:joined' | 'user:left' | 'user:update' |
    'controller:update' | 'selection:update' | 'ping' | 'pong';
  sessionId?: string;
  sceneId?: string;
  userId?: string;
  user?: SceneUser;
  change?: SceneChange;
  scene?: SceneData;
  data?: any;
  timestamp?: number;
}

export class SceneManager extends EventEmitter {
  private static instance: SceneManager;

  // Сцена и Three.js
  private currentScene: SceneData | null = null;
  private threeScene: THREE.Scene | null = null;
  private objectMap: Map<string, THREE.Object3D> = new Map();
  private componentInstances: Map<string, ComponentInstance> = new Map();

  // Сеть
  private ws: WebSocket | null = null;
  private wsReconnectTimer: NodeJS.Timeout | null = null;
  private wsConnected = false;
  private sessionId: string | null = null;
  private currentUser: SceneUser | null = null;
  private remoteUsers: Map<string, SceneUser> = new Map();

  // Очереди и синхронизация
  private changeQueue: SceneChange[] = [];
  private pendingChanges: Map<string, SceneChange> = new Map();
  private syncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  // История
  private snapshots: SceneSnapshot[] = [];
  private maxSnapshots = 50;

  // Временные объекты
  private tempVector = new THREE.Vector3();
  private tempEuler = new THREE.Euler();
  private tempQuaternion = new THREE.Quaternion();

  // Настройки
  private config = {
    wsUrl: null as string | null,
    autoReconnect: true,
    reconnectDelay: 3000,
    syncInterval: 100, // мс
    maxRetries: 10,
  };

  private constructor() {
    super();
  }

  static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  // ==================== Инициализация и конфигурация ====================

  configure(options: { wsUrl?: string; autoReconnect?: boolean }) {
    if (options.wsUrl) {
      this.config.wsUrl = options.wsUrl;
    }
    if (options.autoReconnect !== undefined) {
      this.config.autoReconnect = options.autoReconnect;
    }
  }

  initThreeScene(scene: THREE.Scene) {
    this.threeScene = scene;
    this.emit('three:ready', scene);
  }

  // ==================== Управление пользователем и сессией ====================

  setCurrentUser(user: { id: string; name: string; sessionType: 'editor' | 'vr' }) {
    this.currentUser = {
      id: user.id,
      name: user.name,
      color: this.generateUserColor(user.id),
      sessionType: user.sessionType,
    };
  }

  private generateUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  // ==================== WebSocket соединение ====================

  connect(wsUrl?: string): Promise<void> {
    if (wsUrl) {
      this.config.wsUrl = wsUrl;
    }

    if (!this.config.wsUrl) {
      // Автоматически определяем URL
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
      this.config.wsUrl = `${protocol}//${host}/api/ws/scenes`;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl!);

        this.ws.onopen = () => {
          console.log('[SceneManager] WebSocket connected');
          this.wsConnected = true;
          this.clearReconnectTimer();

          // Авторизуемся
          this.sendMessage({
            type: 'auth',
            user: this.currentUser || undefined,
          });

          // Запускаем синхронизацию
          this.startSyncInterval();

          // Отправляем отложенные изменения
          this.syncPendingChanges();

          this.emit('ws:connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: NetworkMessage = JSON.parse(event.data);
            this.handleNetworkMessage(message);
          } catch (error) {
            console.error('[SceneManager] Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('[SceneManager] WebSocket disconnected');
          this.wsConnected = false;
          this.sessionId = null;
          this.stopSyncInterval();
          this.emit('ws:disconnected');

          if (this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[SceneManager] WebSocket error:', error);
          this.emit('ws:error', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    this.config.autoReconnect = false;
    this.clearReconnectTimer();

    if (this.ws) {
      this.sendMessage({ type: 'scene:leave' });
      this.ws.close();
      this.ws = null;
    }

    this.stopSyncInterval();
  }

  private scheduleReconnect() {
    if (!this.config.autoReconnect) return;

    this.clearReconnectTimer();
    this.wsReconnectTimer = setTimeout(() => {
      console.log('[SceneManager] Reconnecting...');
      this.connect();
    }, this.config.reconnectDelay);
  }

  private clearReconnectTimer() {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
  }

  isConnected(): boolean {
    return this.wsConnected && this.sessionId !== null;
  }

  // ==================== Обработка сетевых сообщений ====================

  private handleNetworkMessage(message: NetworkMessage) {
    switch (message.type) {
      case 'auth':
        this.sessionId = message.sessionId || null;
        this.emit('session:created', this.sessionId);
        break;

      case 'scene:sync':
        this.receiveSceneSync(message.scene!);
        break;

      case 'scene:change':
        this.applyRemoteChange(message.change!, message.userId);
        break;

      case 'user:joined':
        if (message.user) {
          this.remoteUsers.set(message.user.id, message.user);
          this.emit('user:joined', message.user);
        }
        break;

      case 'user:left':
        if (message.userId) {
          const user = this.remoteUsers.get(message.userId);
          this.remoteUsers.delete(message.userId);
          if (user) {
            this.emit('user:left', user);
          }
        }
        break;

      case 'user:update':
        if (message.user) {
          this.remoteUsers.set(message.user.id, message.user);
          this.emit('user:updated', message.user);
        }
        break;

      case 'controller:update':
        if (message.userId && message.data) {
          const user = this.remoteUsers.get(message.userId);
          if (user) {
            user.controllerState = message.data;
            this.emit('controller:updated', user.id, message.data);
          }
        }
        break;

      case 'selection:update':
        if (message.userId && message.data) {
          this.emit('selection:updated', message.userId, message.data.objectId);
        }
        break;

      case 'scene:request-sync':
        this.sendFullSync();
        break;

      case 'ping':
        this.sendMessage({ type: 'pong', timestamp: Date.now() });
        break;

      case 'pong':
        // Можно использовать для измерения latency
        this.emit('latency', Date.now() - (message.timestamp || 0));
        break;
    }
  }

  private sendMessage(message: NetworkMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[SceneManager] Cannot send message, socket not ready');
      return;
    }

    message.sessionId = this.sessionId || undefined;
    message.sceneId = this.currentScene?.id;
    message.userId = this.currentUser?.id;
    message.timestamp = Date.now();

    this.ws.send(JSON.stringify(message));
  }

  // ==================== Управление сценой ====================

  async loadScene(sceneId: string): Promise<SceneData | null> {
    try {
      // Загружаем сцену через REST API
      const response = await fetch(`/api/scenes/${sceneId}`);
      const data = await response.json();

      if (response.ok) {
        this.currentScene = data.scene;
        await this.buildThreeScene();
        this.takeSnapshot();

        // Присоединяемся к сессии сцены
        if (this.isConnected()) {
          this.sendMessage({ type: 'scene:join', sceneId });
        }

        this.emit('scene:loaded', this.currentScene);
        return this.currentScene;
      }
    } catch (error) {
      console.error('[SceneManager] Failed to load scene:', error);
      this.emit('scene:error', error);
    }

    return null;
  }

  createScene(name: string): SceneData {
    const scene: SceneData = {
      id: this.generateId(),
      name,
      description: '',
      objects: {},
      rootObjects: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      settings: {
        ambientLight: {
          color: '#404040',
          intensity: 0.5,
        },
      },
    };

    this.currentScene = scene;
    this.buildThreeScene();
    this.takeSnapshot();

    // Присоединяемся к сессии
    if (this.isConnected()) {
      this.sendMessage({ type: 'scene:join', sceneId: scene.id });
    }

    this.emit('scene:created', scene);

    return scene;
  }

  async saveScene(): Promise<boolean> {
    if (!this.currentScene) return false;

    try {
      const response = await fetch(`/api/scenes/${this.currentScene.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: this.currentScene }),
      });

      if (response.ok) {
        this.emit('scene:saved', this.currentScene);
        return true;
      }
    } catch (error) {
      console.error('[SceneManager] Failed to save scene:', error);
      this.emit('scene:error', error);
    }

    return false;
  }

  // ==================== Построение Three.js сцены ====================

  private async buildThreeScene() {
    if (!this.threeScene || !this.currentScene) return;

    this.clearThreeScene();
    this.applySceneSettings();

    for (const objectId of this.currentScene.rootObjects) {
      const object = this.currentScene.objects[objectId];
      if (object) {
        await this.createThreeObject(object);
      }
    }

    this.emit('scene:built', this.threeScene);
  }

  private clearThreeScene() {
    if (!this.threeScene) return;

    const toRemove: THREE.Object3D[] = [];
    this.threeScene.traverse((obj) => {
      if (!(obj instanceof THREE.Camera) && !obj.userData.isDefault) {
        toRemove.push(obj);
      }
    });

    toRemove.forEach(obj => this.threeScene!.remove(obj));
    this.objectMap.clear();
  }

  private applySceneSettings() {
    if (!this.threeScene || !this.currentScene) return;

    const { settings } = this.currentScene;

    const ambientLight = new THREE.AmbientLight(
      settings.ambientLight.color,
      settings.ambientLight.intensity
    );
    ambientLight.userData.isDefault = true;
    this.threeScene.add(ambientLight);

    if (settings.fog) {
      const fogColor = new THREE.Color(settings.fog.color);
      if (settings.fog.type === 'linear' && settings.fog.near && settings.fog.far) {
        this.threeScene.fog = new THREE.Fog(fogColor, settings.fog.near, settings.fog.far);
      } else if (settings.fog.type === 'exp2' && settings.fog.density) {
        this.threeScene.fog = new THREE.FogExp2(fogColor, settings.fog.density);
      }
    }

    if (settings.skybox) {
      if (settings.skybox.type === 'color') {
        this.threeScene.background = new THREE.Color(settings.skybox.value);
      }
    }
  }

  private async createThreeObject(data: AnySceneObject): Promise<THREE.Object3D | null> {
    let object3D: THREE.Object3D | null = null;

    switch (data.type) {
      case 'primitive':
        object3D = this.createPrimitive(data as any);
        break;
      case 'light':
        object3D = this.createLight(data as any);
        break;
      case 'empty':
        object3D = new THREE.Group();
        break;
    }

    if (object3D) {
      this.applyTransform(object3D, data.transform);

      object3D.userData.sceneId = data.id;
      object3D.userData.objectType = data.type;
      object3D.userData.locked = data.locked;
      object3D.visible = data.visible;

      if (data.parentId) {
        const parent = this.objectMap.get(data.parentId);
        parent?.add(object3D);
      } else {
        this.threeScene?.add(object3D);
      }

      this.objectMap.set(data.id, object3D);

      for (const childId of data.children) {
        const child = this.currentScene?.objects[childId];
        if (child) {
          await this.createThreeObject(child);
        }
      }

      this.initializeComponents(data.id, data.components);
    }

    return object3D;
  }

  private createPrimitive(data: any): THREE.Mesh {
    let geometry: THREE.BufferGeometry;

    switch (data.primitiveType) {
      case 'cube':
        geometry = new THREE.BoxGeometry(
          data.params?.width || 1,
          data.params?.height || 1,
          data.params?.depth || 1
        );
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          data.params?.radius || 0.5,
          data.params?.radialSegments || 32
        );
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          data.params?.radiusTop || 0.5,
          data.params?.radiusBottom || 0.5,
          data.params?.height || 1,
          data.params?.radialSegments || 32
        );
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(
          data.params?.width || 1,
          data.params?.height || 1
        );
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(
          data.params?.radius || 0.5,
          data.params?.tubeRadius || 0.1,
          data.params?.radialSegments || 16,
          data.params?.tubularSegments || 32
        );
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(
          data.params?.radius || 0.5,
          data.params?.height || 1,
          data.params?.radialSegments || 32
        );
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const material = new THREE.MeshStandardMaterial({
      color: data.color || '#ffffff',
      roughness: 0.5,
      metalness: 0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  private createLight(data: any): THREE.Light {
    const color = new THREE.Color(data.params?.color || '#ffffff');
    const intensity = data.params?.intensity || 1;

    switch (data.lightType) {
      case 'ambient':
        return new THREE.AmbientLight(color, intensity);
      case 'directional':
        const dirLight = new THREE.DirectionalLight(color, intensity);
        dirLight.castShadow = data.params?.castShadow || false;
        return dirLight;
      case 'point':
        const pointLight = new THREE.PointLight(color, intensity, data.params?.distance);
        pointLight.castShadow = data.params?.castShadow || false;
        return pointLight;
      case 'spot':
        const spotLight = new THREE.SpotLight(
          color,
          intensity,
          data.params?.distance,
          data.params?.angle,
          data.params?.penumbra
        );
        spotLight.castShadow = data.params?.castShadow || false;
        return spotLight;
      default:
        return new THREE.PointLight(color, intensity);
    }
  }

  private applyTransform(obj: THREE.Object3D, transform: Transform) {
    obj.position.set(transform.position[0], transform.position[1], transform.position[2]);
    obj.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
    obj.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
  }

  private initializeComponents(objectId: string, components: ComponentInstance[]) {
    for (const component of components) {
      this.componentInstances.set(`${objectId}:${component.id}`, component);
      this.emit('component:init', { objectId, component });
    }
  }

  // ==================== Управление объектами ====================

  addObject(object: Partial<AnySceneObject>, parentId?: string): string {
    if (!this.currentScene) throw new Error('No scene loaded');

    const id = this.generateId();
    const newObject: AnySceneObject = {
      id,
      name: object.name || `Object_${id.slice(0, 4)}`,
      type: object.type || 'empty',
      transform: object.transform || {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      visible: object.visible ?? true,
      locked: object.locked ?? false,
      children: [],
      components: [],
      ...object,
    } as AnySceneObject;

    this.currentScene.objects[id] = newObject;

    if (parentId) {
      const parent = this.currentScene.objects[parentId];
      if (parent) {
        parent.children.push(id);
        newObject.parentId = parentId;
      }
    } else {
      this.currentScene.rootObjects.push(id);
    }

    this.createThreeObject(newObject);

    const change: SceneChange = {
      type: 'add',
      target: id,
      data: newObject,
      source: this.currentUser?.sessionType || 'editor',
      timestamp: Date.now(),
      userId: this.currentUser?.id,
    };

    this.sendChange(change);
    this.updateSceneVersion();
    this.emit('object:added', newObject);

    return id;
  }

  removeObject(objectId: string) {
    if (!this.currentScene) return;

    const object = this.currentScene.objects[objectId];
    if (!object) return;

    for (const childId of object.children) {
      this.removeObject(childId);
    }

    if (object.parentId) {
      const parent = this.currentScene.objects[object.parentId];
      if (parent) {
        parent.children = parent.children.filter(id => id !== objectId);
      }
    } else {
      this.currentScene.rootObjects = this.currentScene.rootObjects.filter(id => id !== objectId);
    }

    const threeObject = this.objectMap.get(objectId);
    if (threeObject) {
      threeObject.parent?.remove(threeObject);
      this.objectMap.delete(objectId);
    }

    for (const component of object.components) {
      this.componentInstances.delete(`${objectId}:${component.id}`);
    }

    delete this.currentScene.objects[objectId];

    const change: SceneChange = {
      type: 'remove',
      target: objectId,
      data: null,
      source: this.currentUser?.sessionType || 'editor',
      timestamp: Date.now(),
      userId: this.currentUser?.id,
    };

    this.sendChange(change);
    this.updateSceneVersion();
    this.emit('object:removed', objectId);
  }

  updateObject(objectId: string, updates: Partial<AnySceneObject>) {
    if (!this.currentScene) return;

    const object = this.currentScene.objects[objectId];
    if (!object) return;

    Object.assign(object, updates);

    const threeObject = this.objectMap.get(objectId);
    if (threeObject) {
      if (updates.transform) {
        this.applyTransform(threeObject, updates.transform);
      }
      if (updates.visible !== undefined) {
        threeObject.visible = updates.visible;
      }
    }

    const change: SceneChange = {
      type: 'update',
      target: objectId,
      data: updates,
      source: this.currentUser?.sessionType || 'editor',
      timestamp: Date.now(),
      userId: this.currentUser?.id,
    };

    this.sendChange(change);
    this.updateSceneVersion();
    this.emit('object:updated', { objectId, updates });
  }

  transformObject(objectId: string, transform: Partial<Transform>) {
    if (!this.currentScene) return;

    const object = this.currentScene.objects[objectId];
    if (!object) return;

    object.transform = {
      ...object.transform,
      ...transform,
    };

    const threeObject = this.objectMap.get(objectId);
    if (threeObject) {
      if (transform.position) {
        threeObject.position.set(transform.position[0], transform.position[1], transform.position[2]);
      }
      if (transform.rotation) {
        threeObject.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
      }
      if (transform.scale) {
        threeObject.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
      }
    }

    const change: SceneChange = {
      type: 'transform',
      target: objectId,
      data: transform,
      source: this.currentUser?.sessionType || 'editor',
      timestamp: Date.now(),
      userId: this.currentUser?.id,
    };

    this.sendChange(change);
    this.emit('object:transformed', { objectId, transform });
  }

  // ==================== Синхронизация изменений ====================

  private sendChange(change: SceneChange) {
    if (!change.userId) {
      change.userId = this.currentUser?.id;
    }

    this.changeQueue.push(change);

    if (this.isConnected()) {
      this.syncPendingChanges();
    }
  }

  private syncPendingChanges() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.syncing) return;

    this.syncing = true;

    while (this.changeQueue.length > 0) {
      const change = this.changeQueue.shift()!;
      const changeId = `${change.timestamp}-${change.target}`;
      this.pendingChanges.set(changeId, change);

      this.sendMessage({
        type: 'scene:change',
        change,
      });
    }

    this.syncing = false;
  }

  private applyRemoteChange(change: SceneChange, userId?: string) {
    if (!this.currentScene) return;

    // Игнорируем свои изменения
    if (userId === this.currentUser?.id) return;

    switch (change.type) {
      case 'add':
        const newObject = change.data as AnySceneObject;
        this.currentScene.objects[newObject.id] = newObject;
        this.createThreeObject(newObject);
        this.emit('remote:object:added', newObject, userId);
        break;

      case 'remove':
        this.removeObjectLocal(change.target);
        this.emit('remote:object:removed', change.target, userId);
        break;

      case 'update':
        this.updateObjectLocal(change.target, change.data);
        this.emit('remote:object:updated', change.target, change.data, userId);
        break;

      case 'transform':
        this.transformObjectLocal(change.target, change.data);
        this.emit('remote:object:transformed', change.target, change.data, userId);
        break;

      case 'component':
        this.handleComponentChangeRemote(change.target, change.data, userId);
        break;

      case 'settings':
        this.updateSettingsRemote(change.data, userId);
        break;
    }

    this.updateSceneVersion();
  }

  private removeObjectLocal(objectId: string) {
    const object = this.currentScene?.objects[objectId];
    if (!object) return;

    const threeObject = this.objectMap.get(objectId);
    if (threeObject) {
      threeObject.parent?.remove(threeObject);
      this.objectMap.delete(objectId);
    }

    delete this.currentScene!.objects[objectId];
  }

  private updateObjectLocal(objectId: string, updates: Partial<AnySceneObject>) {
    const object = this.currentScene?.objects[objectId];
    if (!object) return;

    Object.assign(object, updates);

    const threeObject = this.objectMap.get(objectId);
    if (threeObject) {
      if (updates.transform) {
        this.applyTransform(threeObject, updates.transform);
      }
      if (updates.visible !== undefined) {
        threeObject.visible = updates.visible;
      }
    }
  }

  private transformObjectLocal(objectId: string, transform: Partial<Transform>) {
    const object = this.currentScene?.objects[objectId];
    if (!object) return;

    object.transform = {
      ...object.transform,
      ...transform,
    };

    const threeObject = this.objectMap.get(objectId);
    if (threeObject) {
      if (transform.position) {
        threeObject.position.set(transform.position[0], transform.position[1], transform.position[2]);
      }
      if (transform.rotation) {
        threeObject.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
      }
      if (transform.scale) {
        threeObject.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
      }
    }
  }

  private handleComponentChangeRemote(objectId: string, data: any, userId?: string) {
    // Обработка удаленных изменений компонентов
    this.emit('remote:component:changed', { objectId, data, userId });
  }

  private updateSettingsRemote(settings: Partial<SceneData['settings']>, userId?: string) {
    if (!this.currentScene) return;

    this.currentScene.settings = {
      ...this.currentScene.settings,
      ...settings,
    };

    this.emit('remote:settings:updated', settings, userId);
  }

  private sendFullSync() {
    if (!this.currentScene) return;

    this.sendMessage({
      type: 'scene:sync',
      scene: this.currentScene,
    });
  }

  private receiveSceneSync(scene: SceneData) {
    this.currentScene = scene;
    this.buildThreeScene();
    this.emit('scene:synced', scene);
  }

  // ==================== Обновление состояния VR ====================

  sendControllerState(controller: 'left' | 'right', state: {
    position: [number, number, number];
    rotation: [number, number, number];
    buttons: Record<string, boolean>;
  }) {
    if (!this.isConnected()) return;

    this.sendMessage({
      type: 'controller:update',
      data: {
        controller,
        ...state,
      },
    });
  }

  sendSelectionUpdate(objectId: string | null) {
    if (!this.isConnected()) return;

    this.sendMessage({
      type: 'selection:update',
      data: { objectId },
    });
  }

  // ==================== Синхронизация по интервалу ====================

  private startSyncInterval() {
    this.stopSyncInterval();
    this.syncInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.config.syncInterval);
  }

  private stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ==================== История ====================

  private takeSnapshot() {
    if (!this.currentScene) return;

    this.snapshots.push({
      sceneId: this.currentScene.id,
      data: JSON.parse(JSON.stringify(this.currentScene)),
      timestamp: Date.now(),
    });

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  undo(): boolean {
    if (this.snapshots.length < 2) return false;

    this.snapshots.pop();
    const snapshot = this.snapshots[this.snapshots.length - 1];
    this.currentScene = JSON.parse(JSON.stringify(snapshot.data));
    this.buildThreeScene();

    const change: SceneChange = {
      type: 'update',
      target: 'scene',
      data: this.currentScene,
      source: this.currentUser?.sessionType || 'editor',
      timestamp: Date.now(),
      userId: this.currentUser?.id,
    };

    this.sendChange(change);
    this.emit('scene:undo', this.currentScene);

    return true;
  }

  // ==================== Вспомогательные методы ====================

  private updateSceneVersion() {
    if (this.currentScene) {
      this.currentScene.metadata.version++;
      this.currentScene.metadata.updatedAt = new Date().toISOString();
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Геттеры ====================

  getCurrentScene(): SceneData | null {
    return this.currentScene;
  }

  getThreeScene(): THREE.Scene | null {
    return this.threeScene;
  }

  getObjectById(id: string): AnySceneObject | null {
    return this.currentScene?.objects[id] || null;
  }

  getThreeObjectById(id: string): THREE.Object3D | null {
    return this.objectMap.get(id) || null;
  }

  getRemoteUsers(): SceneUser[] {
    return Array.from(this.remoteUsers.values());
  }

  getRemoteUser(userId: string): SceneUser | null {
    return this.remoteUsers.get(userId) || null;
  }

  getCurrentUser(): SceneUser | null {
    return this.currentUser;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}
