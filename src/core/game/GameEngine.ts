// core/game/GameEngine.ts
import * as THREE from 'three';
import { EventEmitter } from 'events';
import { SceneManager } from '../scene/SceneManager';
import { ScriptEngine } from './ScriptEngine';
import { AnySceneObject, ComponentInstance } from '../scene/types';

export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  currentSceneId: string | null;
  startTime: number;
  elapsedTime: number;
  deltaTime: number;
  frameCount: number;
}

export interface PlayerController {
  id: string;
  object: THREE.Object3D;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  isGrounded: boolean;
  isMoving: boolean;
  isJumping: boolean;
}

export interface GameEvent {
  type: string;
  target?: string | THREE.Object3D;
  data?: any;
  timestamp: number;
}

// Типы для рантайма компонентов
interface ComponentRuntime {
  id: string;
  scriptName: string;
  objectId: string;
  object: THREE.Object3D;
  state: Record<string, any>;
  enabled: boolean;
  module: any;
  instance: any;
  instanceId?: string;
  component?: ComponentInstance;
  update?: (deltaTime: number) => void;
  fixedUpdate?: (fixedDeltaTime: number) => void;
  lateUpdate?: (deltaTime: number) => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onDestroy?: () => void;
  onHotReload?: (oldState: any) => void;
}

export class GameEngine extends EventEmitter {
  private static instance: GameEngine;

  private sceneManager: SceneManager;
  private scriptEngine: ScriptEngine;

  private gameState: GameState = {
    isPlaying: false,
    isPaused: false,
    currentSceneId: null,
    startTime: 0,
    elapsedTime: 0,
    deltaTime: 0,
    frameCount: 0,
  };

  private player: PlayerController | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;

  // Системы
  private updateSystems: Array<(deltaTime: number) => void> = [];
  private fixedUpdateSystems: Array<(fixedDeltaTime: number) => void> = [];
  private lateUpdateSystems: Array<(deltaTime: number) => void> = [];

  // Компоненты и объекты
  private activeComponents: Map<string, ComponentRuntime> = new Map();
  private objectComponents: Map<string, Set<string>> = new Map();
  private componentInstances: Map<string, { instanceId: string; component: ComponentInstance }> = new Map();

  // События
  private eventQueue: GameEvent[] = [];
  private eventListeners: Map<string, Set<Function>> = new Map();

  // Hot reload
  private hotReloadQueue: Array<{ file: string; content: string }> = [];

  // Физика (упрощенная)
  private gravity = -9.8;
  private groundY = 0;
  private physicsObjects: Map<string, {
    velocity: THREE.Vector3;
    mass: number;
    useGravity: boolean;
  }> = new Map();

  private constructor() {
    super();
    this.sceneManager = SceneManager.getInstance();
    this.scriptEngine = ScriptEngine.getInstance();

    this.setupScriptEngine();
  }

  static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  // ==================== Инициализация ====================

  private createGameAPI() {
    const self = this;
    return {
      // Управление игрой
      loadScene: (sceneId: string) => self.loadScene(sceneId),
      getCurrentScene: () => self.gameState.currentSceneId,

      // Время
      getTime: () => self.gameState.elapsedTime,
      getDeltaTime: () => self.gameState.deltaTime,

      // Игрок
      getPlayer: () => self.player,
      setPlayerPosition: (pos: THREE.Vector3) => self.setPlayerPosition(pos),
      movePlayer: (direction: THREE.Vector3, speed?: number) => self.movePlayer(direction, speed),
      rotatePlayer: (yaw: number) => self.rotatePlayer(yaw),
      jumpPlayer: (force?: number) => self.jumpPlayer(force),

      // События
      emit: (eventType: string, data?: any) => self.emitGameEvent(eventType, data),
      on: (eventType: string, callback: Function) => self.onGameEvent(eventType, callback),
      off: (eventType: string, callback: Function) => self.offGameEvent(eventType, callback),

      // Объекты
      findObject: (nameOrId: string) => self.findObject(nameOrId),
      instantiate: (prefabId: string, position?: THREE.Vector3) => self.instantiate(prefabId, position),
      destroy: (objectId: string) => self.destroyObject(objectId),

      // Физика
      addForce: (objectId: string, force: THREE.Vector3) => self.addForce(objectId, force),
      setVelocity: (objectId: string, velocity: THREE.Vector3) => self.setVelocity(objectId, velocity),

      // Утилиты
      wait: (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000)),
      lerp: THREE.MathUtils.lerp,
      random: Math.random,

      // Состояние игры
      isPlaying: () => self.gameState.isPlaying,
      isPaused: () => self.gameState.isPaused,
      pause: () => self.pauseGame(),
      resume: () => self.resumeGame(),
    };
  }

  private setupScriptEngine() {
    // Регистрируем API для скриптов
    this.scriptEngine.registerAPI('game', this.createGameAPI());
    this.scriptEngine.registerAPI('THREE', THREE);

    // Подписываемся на события скриптов
    this.scriptEngine.onScriptEvent('*', (event: string, data: any) => {
      this.emitGameEvent(`script:${event}`, data);
    });

    // Подписываемся на hot reload
    this.sceneManager.on('hot-reload', ({ file, content }: { file: string; content: string }) => {
      this.handleHotReload(file, content);
    });
  }

  // ==================== Управление игрой ====================

  async startGame(sceneId?: string) {
    if (this.gameState.isPlaying) {
      console.warn('[GameEngine] Game already running');
      return;
    }

    console.log('[GameEngine] Starting game...');

    // Загружаем сцену если нужно
    if (sceneId) {
      await this.loadScene(sceneId);
    }

    if (!this.gameState.currentSceneId) {
      throw new Error('No scene loaded');
    }

    // Инициализируем игрока если его нет
    if (!this.player) {
      this.createPlayer();
    }

    // Инициализируем все компоненты в сцене
    await this.initializeSceneComponents();

    // Сбрасываем состояние
    this.gameState = {
      isPlaying: true,
      isPaused: false,
      currentSceneId: this.gameState.currentSceneId,
      startTime: performance.now(),
      elapsedTime: 0,
      deltaTime: 0,
      frameCount: 0,
    };

    this.clock = new THREE.Clock();
    this.lastTimestamp = performance.now();

    // Запускаем игровой цикл
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));

    this.emitGameEvent('game:start');
    this.emit('game:started');

    console.log('[GameEngine] Game started');
  }

  pauseGame() {
    if (!this.gameState.isPlaying || this.gameState.isPaused) return;

    this.gameState.isPaused = true;
    this.emitGameEvent('game:pause');
    this.emit('game:paused');
  }

  resumeGame() {
    if (!this.gameState.isPlaying || !this.gameState.isPaused) return;

    this.gameState.isPaused = false;
    this.clock = new THREE.Clock();
    this.emitGameEvent('game:resume');
    this.emit('game:resumed');
  }

  stopGame() {
    if (!this.gameState.isPlaying) return;

    console.log('[GameEngine] Stopping game...');

    this.gameState.isPlaying = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Очищаем компоненты
    this.cleanupComponents();

    this.emitGameEvent('game:stop');
    this.emit('game:stopped');

    console.log('[GameEngine] Game stopped');
  }

  // ==================== Игровой цикл ====================

  private gameLoop(timestamp: number) {
    if (!this.gameState.isPlaying) return;

    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));

    if (this.gameState.isPaused) return;

    // Вычисляем deltaTime
    const deltaTime = Math.min(this.clock.getDelta(), 0.033); // Максимум 33ms

    this.gameState.deltaTime = deltaTime;
    this.gameState.elapsedTime += deltaTime;
    this.gameState.frameCount++;

    // Обрабатываем hot reload
    this.processHotReloadQueue();

    // Обрабатываем события
    this.processEventQueue();

    // Update системы
    for (const system of this.updateSystems) {
      system(deltaTime);
    }

    // Обновляем все компоненты через ScriptEngine
    this.scriptEngine.updateInstances(deltaTime, this.gameState.elapsedTime);

    // Fixed Update (физика)
    const fixedDeltaTime = 1 / 60;
    let accumulator = this.gameState.elapsedTime - (this.gameState.frameCount - 1) * fixedDeltaTime;
    while (accumulator >= fixedDeltaTime) {
      for (const system of this.fixedUpdateSystems) {
        system(fixedDeltaTime);
      }
      this.scriptEngine.fixedUpdateInstances(fixedDeltaTime);
      accumulator -= fixedDeltaTime;
    }

    // Обновляем игрока
    this.updatePlayer(deltaTime);

    // Late Update
    for (const system of this.lateUpdateSystems) {
      system(deltaTime);
    }
    this.scriptEngine.lateUpdateInstances(deltaTime);
  }

  // ==================== Управление сценами ====================

  async loadScene(sceneId: string) {
    console.log(`[GameEngine] Loading scene: ${sceneId}`);

    this.emitGameEvent('scene:beforeLoad', { sceneId });

    const scene = await this.sceneManager.loadScene(sceneId);

    if (!scene) {
      throw new Error(`Failed to load scene: ${sceneId}`);
    }

    this.gameState.currentSceneId = sceneId;

    // Если игра уже запущена, инициализируем компоненты
    if (this.gameState.isPlaying) {
      await this.initializeSceneComponents();
    }

    this.emitGameEvent('scene:loaded', { sceneId, scene });
    this.emit('scene:loaded', scene);

    console.log(`[GameEngine] Scene loaded: ${scene.name}`);
  }

  // ==================== Управление игроком ====================

  private createPlayer() {
    const playerObject = new THREE.Group();
    playerObject.name = 'Player';

    // Добавляем камеру
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    playerObject.add(camera);

    // Добавляем коллайдер (невидимый)
    const collider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    collider.position.y = 0.9;
    playerObject.add(collider);

    this.sceneManager.getThreeScene()?.add(playerObject);

    this.player = {
      id: 'player',
      object: playerObject,
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      isGrounded: true,
      isMoving: false,
      isJumping: false,
    };

    console.log('[GameEngine] Player created');
  }

  private updatePlayer(deltaTime: number) {
    if (!this.player) return;

    // Гравитация
    if (!this.player.isGrounded) {
      this.player.velocity.y += this.gravity * deltaTime;
    }

    // Применяем скорость
    this.player.position.add(this.player.velocity.clone().multiplyScalar(deltaTime));

    // Проверка земли
    if (this.player.position.y <= this.groundY) {
      this.player.position.y = this.groundY;
      this.player.velocity.y = 0;
      this.player.isGrounded = true;
      this.player.isJumping = false;
    } else {
      this.player.isGrounded = false;
    }

    // Трение
    this.player.velocity.x *= 0.9;
    this.player.velocity.z *= 0.9;

    // Применяем позицию к объекту
    this.player.object.position.copy(this.player.position);
    this.player.object.rotation.copy(this.player.rotation);

    // Проверка движения
    this.player.isMoving = this.player.velocity.length() > 0.1;
  }

  setPlayerPosition(pos: THREE.Vector3) {
    if (!this.player) return;

    this.player.position.copy(pos);
    this.player.object.position.copy(pos);
  }

  movePlayer(direction: THREE.Vector3, speed: number = 5) {
    if (!this.player) return;

    direction.normalize();
    direction.applyEuler(new THREE.Euler(0, this.player.rotation.y, 0));

    this.player.velocity.x = direction.x * speed;
    this.player.velocity.z = direction.z * speed;
  }

  rotatePlayer(yaw: number) {
    if (!this.player) return;
    this.player.rotation.y += yaw;
  }

  jumpPlayer(force: number = 5) {
    if (!this.player || !this.player.isGrounded || this.player.isJumping) return;

    this.player.velocity.y = force;
    this.player.isGrounded = false;
    this.player.isJumping = true;
  }

  // ==================== Компоненты и скрипты ====================

  private async initializeSceneComponents() {
    const scene = this.sceneManager.getCurrentScene();
    if (!scene) return;

    for (const [objectId, object] of Object.entries(scene.objects)) {
      for (const component of object.components) {
        await this.initializeComponent(objectId, object, component);
      }
    }
  }

  private async initializeComponent(objectId: string, object: AnySceneObject, component: ComponentInstance) {
    const threeObject = this.sceneManager.getThreeObjectById(objectId);
    if (!threeObject) return;

    // Используем ScriptEngine для создания инстанса
    const instanceId = this.scriptEngine.createInstance(
      component.scriptName,
      threeObject,
      component.state
    );

    if (instanceId) {
      // Сохраняем связь
      const key = `${objectId}:${component.id}`;
      this.componentInstances.set(key, {
        instanceId,
        component,
      });
    }
  }

  private cleanupComponents() {
    for (const [key, { instanceId }] of this.componentInstances) {
      this.scriptEngine.destroyInstance(instanceId);
    }

    this.componentInstances.clear();
    this.objectComponents.clear();
  }

  private destroyComponent(objectId: string, componentId: string) {
    const key = `${objectId}:${componentId}`;
    const data = this.componentInstances.get(key);

    if (data) {
      this.scriptEngine.destroyInstance(data.instanceId);
      this.componentInstances.delete(key);
      this.objectComponents.get(objectId)?.delete(componentId);
    }
  }

  // ==================== Hot Reload ====================

  private handleHotReload(file: string, content: string) {
    console.log(`[GameEngine] Hot reload requested for: ${file}`);
    this.hotReloadQueue.push({ file, content });
  }

  private async processHotReloadQueue() {
    while (this.hotReloadQueue.length > 0) {
      const { file, content } = this.hotReloadQueue.shift()!;
      const scriptName = file.replace(/\.js$/, '');
      await this.scriptEngine.reloadScript(scriptName, content);
      this.emitGameEvent('hot-reload:complete', { scriptName });
    }
  }

  // ==================== Система событий ====================

  emitGameEvent(type: string, data?: any) {
    const event: GameEvent = {
      type,
      data,
      timestamp: performance.now(),
    };

    this.eventQueue.push(event);
  }

  onGameEvent(type: string, callback: Function) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(callback);
  }

  offGameEvent(type: string, callback: Function) {
    this.eventListeners.get(type)?.delete(callback);
  }

  private processEventQueue() {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      const listeners = this.eventListeners.get(event.type);

      if (listeners) {
        for (const callback of listeners) {
          try {
            callback(event.data, event);
          } catch (error) {
            console.error(`[GameEngine] Error in event listener for ${event.type}:`, error);
          }
        }
      }

      this.emit(event.type, event.data);
    }
  }

  // ==================== Управление объектами ====================

  findObject(nameOrId: string): THREE.Object3D | null {
    const scene = this.sceneManager.getThreeScene();
    if (!scene) return null;

    let found: THREE.Object3D | null = null;

    scene.traverse((obj) => {
      if (obj.name === nameOrId || obj.userData.sceneId === nameOrId) {
        found = obj;
      }
    });

    return found;
  }

  instantiate(prefabId: string, position?: THREE.Vector3): string | null {
    console.log(`[GameEngine] Instantiating prefab: ${prefabId}`);
    return null;
  }

  destroyObject(objectId: string) {
    this.sceneManager.removeObject(objectId);
  }

  // ==================== Физика ====================

  addForce(objectId: string, force: THREE.Vector3) {
    const physics = this.physicsObjects.get(objectId);
    if (physics) {
      physics.velocity.add(force.clone().divideScalar(physics.mass));
    }
  }

  setVelocity(objectId: string, velocity: THREE.Vector3) {
    const physics = this.physicsObjects.get(objectId);
    if (physics) {
      physics.velocity.copy(velocity);
    }
  }

  // ==================== Системы ====================

  registerUpdateSystem(system: (deltaTime: number) => void) {
    this.updateSystems.push(system);
  }

  registerFixedUpdateSystem(system: (fixedDeltaTime: number) => void) {
    this.fixedUpdateSystems.push(system);
  }

  registerLateUpdateSystem(system: (deltaTime: number) => void) {
    this.lateUpdateSystems.push(system);
  }

  // ==================== Геттеры ====================

  getGameState(): GameState {
    return { ...this.gameState };
  }

  getPlayer(): PlayerController | null {
    return this.player;
  }

  isPlaying(): boolean {
    return this.gameState.isPlaying;
  }

  isPaused(): boolean {
    return this.gameState.isPaused;
  }
}
