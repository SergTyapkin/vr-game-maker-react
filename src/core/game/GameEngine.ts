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

  // События
  private eventQueue: GameEvent[] = [];
  private eventListeners: Map<string, Set<Function>> = new Map();

  // Hot reload
  private hotReloadQueue: Array<{ file: string; content: string }> = [];

  // Физика (упрощенная)
  private gravity = -9.8;
  private groundY = 0;

  private constructor() {
    super();
    this.sceneManager = SceneManager.getInstance();
    this.scriptEngine = ScriptEngine.getInstance();

    // Регистрируем API для скриптов
    this.scriptEngine.registerAPI('game', this.createGameAPI());
    this.scriptEngine.registerAPI('THREE', THREE);

    // Подписываемся на события скриптов
    this.scriptEngine.onScriptEvent('*', (event: string, data: any) => {
      this.emitGameEvent(`script:${event}`, data);
    });

    this.setupScriptEngine();
  }

  static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  // ==================== Инициализация ====================

  private setupScriptEngine() {
    // Регистрируем API для скриптов
    this.scriptEngine.registerAPI('game', {
      // Управление игрой
      loadScene: (sceneId: string) => this.loadScene(sceneId),
      getCurrentScene: () => this.gameState.currentSceneId,

      // Время
      getTime: () => this.gameState.elapsedTime,
      getDeltaTime: () => this.gameState.deltaTime,

      // Игрок
      getPlayer: () => this.player,
      setPlayerPosition: (pos: THREE.Vector3) => {
        if (this.player) {
          this.player.position.copy(pos);
          this.player.object.position.copy(pos);
        }
      },

      // События
      emit: (eventType: string, data?: any) => this.emitGameEvent(eventType, data),
      on: (eventType: string, callback: Function) => this.onGameEvent(eventType, callback),
      off: (eventType: string, callback: Function) => this.offGameEvent(eventType, callback),

      // Объекты
      findObject: (nameOrId: string) => this.findObject(nameOrId),
      instantiate: (prefabId: string, position?: THREE.Vector3) => this.instantiate(prefabId, position),
      destroy: (objectId: string) => this.destroyObject(objectId),

      // Физика
      addForce: (objectId: string, force: THREE.Vector3) => this.addForce(objectId, force),
      setVelocity: (objectId: string, velocity: THREE.Vector3) => this.setVelocity(objectId, velocity),

      // Утилиты
      wait: (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000)),
      lerp: THREE.MathUtils.lerp,
      random: Math.random,
    });

    this.scriptEngine.registerAPI('THREE', THREE);

    // Подписываемся на hot reload
    this.sceneManager.on('hot-reload', ({ file, content }) => {
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

    // Обновляем все компоненты
    this.updateComponents(deltaTime);

    // Fixed Update (физика)
    const fixedDeltaTime = 1 / 60;
    let accumulator = this.gameState.elapsedTime - (this.gameState.frameCount - 1) * fixedDeltaTime;
    while (accumulator >= fixedDeltaTime) {
      for (const system of this.fixedUpdateSystems) {
        system(fixedDeltaTime);
      }
      this.fixedUpdateComponents(fixedDeltaTime);
      accumulator -= fixedDeltaTime;
    }

    // Обновляем игрока
    this.updatePlayer(deltaTime);

    // Late Update
    for (const system of this.lateUpdateSystems) {
      system(deltaTime);
    }
    this.lateUpdateComponents(deltaTime);
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

  // Управление игроком
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
    // Используем ScriptEngine для создания инстанса
    const instanceId = this.scriptEngine.createInstance(
      component.scriptName,
      this.sceneManager.getThreeObjectById(objectId),
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

  private updateComponents(deltaTime: number) {
    // Делегируем обновление ScriptEngine
    this.scriptEngine.updateInstances(deltaTime, this.gameState.elapsedTime);
  }

  private fixedUpdateComponents(fixedDeltaTime: number) {
    this.scriptEngine.fixedUpdateInstances(fixedDeltaTime);
  }

  private lateUpdateComponents(deltaTime: number) {
    this.scriptEngine.lateUpdateInstances(deltaTime);
  }

  private async handleHotReload(file: string, content: string) {
    const scriptName = file.replace(/\.js$/, '');
    await this.scriptEngine.reloadScript(scriptName, content);
  }

  private createScriptContext(runtime: ComponentRuntime) {
    const self = this;

    return {
      // Состояние компонента
      state: runtime.state,

      // Объект к которому прикреплен компонент
      object: runtime.object,

      // События
      events: {
        on: (event: string, callback: Function) => {
          self.onGameEvent(event, callback);
        },
        emit: (event: string, data?: any) => {
          self.emitGameEvent(event, { ...data, source: runtime.objectId });
        },
      },

      // Время
      get deltaTime() { return self.gameState.deltaTime; },
      get time() { return self.gameState.elapsedTime; },

      // THREE
      THREE,

      // API игры
      game: this.scriptEngine.getAPI('game'),

      // Специфичные для компонента методы
      getComponent: <T>(componentType: string): T | null => {
        const components = self.objectComponents.get(runtime.objectId);
        if (!components) return null;

        for (const compId of components) {
          const key = `${runtime.objectId}:${compId}`;
          const comp = self.activeComponents.get(key);
          if (comp?.scriptName === componentType) {
            return comp.instance as T;
          }
        }
        return null;
      },

      getComponents: <T>(componentType?: string): T[] => {
        const components = self.objectComponents.get(runtime.objectId);
        if (!components) return [];

        const result: T[] = [];
        for (const compId of components) {
          const key = `${runtime.objectId}:${compId}`;
          const comp = self.activeComponents.get(key);
          if (!componentType || comp?.scriptName === componentType) {
            result.push(comp?.instance as T);
          }
        }
        return result;
      },

      // Трансформация
      get position() { return runtime.object.position; },
      get rotation() { return runtime.object.rotation; },
      get scale() { return runtime.object.scale; },

      setPosition: (x: number, y: number, z: number) => {
        runtime.object.position.set(x, y, z);
      },

      setRotation: (x: number, y: number, z: number) => {
        runtime.object.rotation.set(x, y, z);
      },

      // Утилиты
      destroy: () => {
        self.destroyComponent(runtime.objectId, runtime.id);
      },

      instantiate: (prefabId: string, position?: THREE.Vector3) => {
        return self.instantiate(prefabId, position);
      },
    };
  }

  private updateComponents(deltaTime: number) {
    for (const [key, runtime] of this.activeComponents) {
      if (!runtime.enabled) continue;

      try {
        runtime.update?.(deltaTime);
      } catch (error) {
        console.error(`[GameEngine] Error in update of ${runtime.scriptName}:`, error);
      }
    }
  }

  private fixedUpdateComponents(fixedDeltaTime: number) {
    for (const [key, runtime] of this.activeComponents) {
      if (!runtime.enabled) continue;

      try {
        runtime.fixedUpdate?.(fixedDeltaTime);
      } catch (error) {
        console.error(`[GameEngine] Error in fixedUpdate of ${runtime.scriptName}:`, error);
      }
    }
  }

  private lateUpdateComponents(deltaTime: number) {
    for (const [key, runtime] of this.activeComponents) {
      if (!runtime.enabled) continue;

      try {
        runtime.lateUpdate?.(deltaTime);
      } catch (error) {
        console.error(`[GameEngine] Error in lateUpdate of ${runtime.scriptName}:`, error);
      }
    }
  }

  private cleanupComponents() {
    for (const [key, runtime] of this.activeComponents) {
      try {
        runtime.onDestroy?.();
      } catch (error) {
        console.error(`[GameEngine] Error in destroy of ${runtime.scriptName}:`, error);
      }
    }

    this.activeComponents.clear();
    this.objectComponents.clear();
  }

  private destroyComponent(objectId: string, componentId: string) {
    const key = `${objectId}:${componentId}`;
    const runtime = this.activeComponents.get(key);

    if (runtime) {
      runtime.onDestroy?.();
      this.activeComponents.delete(key);
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
      await this.reloadScript(file, content);
    }
  }

  private async reloadScript(fileName: string, newContent: string) {
    const scriptName = fileName.replace(/\.js$/, '');

    // Находим все компоненты с этим скриптом
    const affectedComponents: ComponentRuntime[] = [];

    for (const [key, runtime] of this.activeComponents) {
      if (runtime.scriptName === scriptName) {
        affectedComponents.push(runtime);
      }
    }

    if (affectedComponents.length === 0) {
      console.log(`[GameEngine] No active components using script: ${scriptName}`);
      return;
    }

    console.log(`[GameEngine] Reloading ${affectedComponents.length} components of ${scriptName}`);

    // Перезагружаем скрипт в ScriptEngine
    await this.scriptEngine.reloadScript(scriptName, newContent);

    // Пересоздаем компоненты
    for (const runtime of affectedComponents) {
      try {
        // Сохраняем состояние
        const oldState = { ...runtime.state };

        // Вызываем onHotReload если есть
        if (runtime.onHotReload) {
          runtime.onHotReload(oldState);
        }

        // Вызываем onDisable и onDestroy
        runtime.onDisable?.();
        runtime.onDestroy?.();

        // Загружаем новый скрипт
        const newModule = await this.scriptEngine.loadScript(scriptName);

        if (!newModule) {
          console.error(`[GameEngine] Failed to reload script: ${scriptName}`);
          continue;
        }

        // Обновляем модуль
        runtime.module = newModule;

        // Восстанавливаем состояние
        runtime.state = { ...oldState, ...runtime.state };

        // Создаем новый контекст и переинициализируем
        const context = this.createScriptContext(runtime);
        const newInstance = newModule.setup(context);

        runtime.instance = newInstance;

        if (newInstance) {
          runtime.update = newInstance.update?.bind(newInstance);
          runtime.fixedUpdate = newInstance.fixedUpdate?.bind(newInstance);
          runtime.lateUpdate = newInstance.lateUpdate?.bind(newInstance);
          runtime.onEnable = newInstance.onEnable?.bind(newInstance);
          runtime.onDisable = newInstance.onDisable?.bind(newInstance);
          runtime.onDestroy = newInstance.onDestroy?.bind(newInstance);
          runtime.onHotReload = newInstance.onHotReload?.bind(newInstance);
        }

        // Вызываем onEnable
        if (runtime.enabled) {
          runtime.onEnable?.();
        }

        console.log(`[GameEngine] Component reloaded: ${scriptName} on ${runtime.objectId}`);
      } catch (error) {
        console.error(`[GameEngine] Failed to reload component ${scriptName}:`, error);
      }
    }

    this.emitGameEvent('hot-reload:complete', { scriptName });
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

      // Также пробрасываем в основной EventEmitter
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
    // Заглушка для инстанцирования префабов
    console.log(`[GameEngine] Instantiating prefab: ${prefabId}`);
    return null;
  }

  destroyObject(objectId: string) {
    this.sceneManager.removeObject(objectId);
  }

  // ==================== Физика ====================

  private physicsObjects: Map<string, {
    velocity: THREE.Vector3;
    mass: number;
    useGravity: boolean;
  }> = new Map();

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
  update?: (deltaTime: number) => void;
  fixedUpdate?: (fixedDeltaTime: number) => void;
  lateUpdate?: (deltaTime: number) => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onDestroy?: () => void;
  onHotReload?: (oldState: any) => void;
}
