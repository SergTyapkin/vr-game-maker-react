// core/game/ScriptEngine.ts
import { EventEmitter } from 'events';

export interface ScriptModule {
  name: string;
  schema?: Record<string, SchemaField>;
  setup: (context: ScriptContext) => ScriptInstance | void;
}

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'color' | 'vector3' | 'object' | 'enum';
  default?: any;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ScriptContext {
  state: Record<string, any>;
  object: any;
  events: ScriptEvents;
  game: any;
  THREE: any;
  deltaTime: number;
  time: number;
  [key: string]: any;
}

export interface ScriptEvents {
  on: (event: string, callback: Function) => void;
  off: (event: string, callback: Function) => void;
  emit: (event: string, data?: any) => void;
}

export interface ScriptInstance {
  update?: (deltaTime: number) => void;
  fixedUpdate?: (fixedDeltaTime: number) => void;
  lateUpdate?: (deltaTime: number) => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onDestroy?: () => void;
  onHotReload?: (oldState: any) => void;
  [key: string]: any;
}

interface CompiledScript {
  id: string;
  name: string;
  source: string;
  module: ScriptModule;
  compiledAt: number;
  dependencies: string[];
}

interface ScriptInstanceRuntime {
  id: string;
  scriptId: string;
  context: ScriptContext;
  instance: ScriptInstance;
  state: Record<string, any>;
  enabled: boolean;
  createdAt: number;
}

export class ScriptEngine extends EventEmitter {
  private static instance: ScriptEngine;

  private scripts: Map<string, CompiledScript> = new Map();
  private instances: Map<string, ScriptInstanceRuntime> = new Map();
  private apis: Map<string, any> = new Map();
  private eventBus: Map<string, Set<Function>> = new Map();
  private scriptCache: Map<string, string> = new Map();

  private sandboxGlobals: any = {};
  private scriptCounter = 0;

  private constructor() {
    super();
    this.initializeSandbox();
  }

  static getInstance(): ScriptEngine {
    if (!ScriptEngine.instance) {
      ScriptEngine.instance = new ScriptEngine();
    }
    return ScriptEngine.instance;
  }

  // ==================== Инициализация песочницы ====================

  private initializeSandbox() {
    // Безопасные глобальные объекты
    this.sandboxGlobals = {
      console: {
        log: (...args: any[]) => console.log('[Script]', ...args),
        warn: (...args: any[]) => console.warn('[Script]', ...args),
        error: (...args: any[]) => console.error('[Script]', ...args),
      },
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      JSON,
      Promise,
      setTimeout: (fn: Function, delay: number) => setTimeout(fn, delay),
      clearTimeout: (id: NodeJS.Timeout) => clearTimeout(id),
      setInterval: (fn: Function, delay: number) => setInterval(fn, delay),
      clearInterval: (id: NodeJS.Timeout) => clearInterval(id),
      performance,
    };
  }

  // ==================== Регистрация API ====================

  registerAPI(name: string, api: any) {
    this.apis.set(name, api);
    console.log(`[ScriptEngine] API registered: ${name}`);
  }

  getAPI(name: string): any {
    return this.apis.get(name);
  }

  // ==================== Загрузка скриптов ====================

  async loadScript(scriptName: string): Promise<ScriptModule | null> {
    // Проверяем кэш
    const cached = this.scripts.get(scriptName);
    if (cached) {
      return cached.module;
    }

    try {
      // Загружаем исходный код
      const source = await this.fetchScriptSource(scriptName);

      if (!source) {
        console.error(`[ScriptEngine] Script not found: ${scriptName}`);
        return null;
      }

      // Компилируем скрипт
      const compiled = await this.compileScript(scriptName, source);

      if (compiled) {
        this.scripts.set(scriptName, compiled);
        this.scriptCache.set(scriptName, source);
        this.emit('script:loaded', { name: scriptName, module: compiled.module });
        return compiled.module;
      }

      return null;
    } catch (error) {
      console.error(`[ScriptEngine] Failed to load script ${scriptName}:`, error);
      this.emit('script:error', { name: scriptName, error });
      return null;
    }
  }

  private async fetchScriptSource(scriptName: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/scripts?path=/${scriptName}.js`);

      if (response.ok) {
        const data = await response.json();
        return data.file?.content || null;
      }

      return null;
    } catch (error) {
      console.error(`[ScriptEngine] Failed to fetch script: ${scriptName}`, error);
      return null;
    }
  }

  private async compileScript(name: string, source: string): Promise<CompiledScript | null> {
    try {
      // Создаем изолированную среду выполнения
      const moduleExports: any = {};
      const moduleContext = {
        exports: moduleExports,
        module: { exports: moduleExports },
        ...this.sandboxGlobals,
        ...this.createScriptAPI(),
      };

      // Оборачиваем код в функцию для изоляции
      const wrappedCode = `
        return (function(module, exports, __sandbox) {
          with (__sandbox) {
            ${source}
          }
          return exports.default || module.exports;
        })
      `;

      // Создаем функцию из кода
      const scriptFunc = new Function(wrappedCode)();

      // Выполняем функцию с контекстом
      const exportedModule = scriptFunc(
        moduleContext.module,
        moduleContext.exports,
        moduleContext
      );

      // Проверяем структуру модуля
      if (!exportedModule || typeof exportedModule.setup !== 'function') {
        throw new Error('Script must export a setup function');
      }

      const compiled: CompiledScript = {
        id: this.generateId(),
        name,
        source,
        module: exportedModule,
        compiledAt: Date.now(),
        dependencies: this.extractDependencies(source),
      };

      return compiled;
    } catch (error) {
      console.error(`[ScriptEngine] Compilation failed for ${name}:`, error);
      this.emit('script:compile-error', { name, error });
      return null;
    }
  }

  private createScriptAPI() {
    return {
      // Импорт других скриптов (для зависимостей)
      require: async (scriptName: string) => {
        return await this.loadScript(scriptName);
      },

      // Регистрация компонента (альтернативный способ)
      registerComponent: (config: any) => {
        return config;
      },
    };
  }

  private extractDependencies(source: string): string[] {
    const dependencies: string[] = [];
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = requireRegex.exec(source)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }

  // ==================== Hot Reload ====================

  async reloadScript(scriptName: string, newSource: string): Promise<boolean> {
    console.log(`[ScriptEngine] Hot reloading: ${scriptName}`);

    const oldScript = this.scripts.get(scriptName);

    try {
      // Компилируем новый код
      const compiled = await this.compileScript(scriptName, newSource);

      if (!compiled) {
        return false;
      }

      // Обновляем в кэше
      this.scripts.set(scriptName, compiled);
      this.scriptCache.set(scriptName, newSource);

      // Уведомляем все инстансы о hot reload
      const affectedInstances = Array.from(this.instances.entries())
        .filter(([_, runtime]) => runtime.scriptId === oldScript?.id);

      for (const [instanceId, runtime] of affectedInstances) {
        this.reloadInstance(instanceId, runtime, compiled, oldScript);
      }

      this.emit('script:reloaded', {
        name: scriptName,
        affectedInstances: affectedInstances.length,
      });

      console.log(`[ScriptEngine] Hot reload complete: ${scriptName} (${affectedInstances.length} instances)`);

      return true;
    } catch (error) {
      console.error(`[ScriptEngine] Hot reload failed for ${scriptName}:`, error);
      this.emit('script:reload-error', { name: scriptName, error });

      // Восстанавливаем старый скрипт
      if (oldScript) {
        this.scripts.set(scriptName, oldScript);
      }

      return false;
    }
  }

  private async reloadInstance(
    instanceId: string,
    oldRuntime: ScriptInstanceRuntime,
    newScript: CompiledScript,
    oldScript?: CompiledScript
  ) {
    try {
      // Сохраняем состояние
      const oldState = { ...oldRuntime.state };

      // Вызываем onHotReload на старом инстансе
      if (oldRuntime.instance.onHotReload) {
        oldRuntime.instance.onHotReload(oldState);
      }

      // Очищаем старый инстанс
      if (oldRuntime.instance.onDisable) {
        oldRuntime.instance.onDisable();
      }
      if (oldRuntime.instance.onDestroy) {
        oldRuntime.instance.onDestroy();
      }

      // Создаем новый контекст с сохраненным состоянием
      const newContext = this.createScriptContext(
        oldRuntime.context.object,
        { ...oldState }
      );

      // Вызываем setup нового скрипта
      const newInstance = newScript.module.setup(newContext);

      if (!newInstance) {
        throw new Error('Setup did not return an instance');
      }

      // Обновляем runtime
      oldRuntime.instance = newInstance;
      oldRuntime.context = newContext;
      oldRuntime.scriptId = newScript.id;

      // Восстанавливаем состояние
      Object.assign(oldRuntime.state, oldState);

      // Вызываем onEnable если был включен
      if (oldRuntime.enabled && newInstance.onEnable) {
        newInstance.onEnable();
      }

      this.emit('instance:reloaded', { instanceId, scriptName: newScript.name });
    } catch (error) {
      console.error(`[ScriptEngine] Failed to reload instance ${instanceId}:`, error);

      // Восстанавливаем старый инстанс
      if (oldScript) {
        oldRuntime.scriptId = oldScript.id;
      }
    }
  }

  // ==================== Управление инстансами ====================

  createInstance(
    scriptName: string,
    object: any,
    initialState: Record<string, any> = {}
  ): string | null {
    const script = this.scripts.get(scriptName);

    if (!script) {
      console.error(`[ScriptEngine] Script not loaded: ${scriptName}`);
      return null;
    }

    try {
      const instanceId = this.generateId();

      // Объединяем состояние с дефолтными значениями из схемы
      const state = { ...initialState };

      if (script.module.schema) {
        for (const [key, field] of Object.entries(script.module.schema)) {
          if (!(key in state) && field.default !== undefined) {
            state[key] = field.default;
          }
        }
      }

      // Создаем контекст
      const context = this.createScriptContext(object, state);

      // Вызываем setup
      const instance = script.module.setup(context);

      if (!instance) {
        console.error(`[ScriptEngine] Setup did not return an instance for ${scriptName}`);
        return null;
      }

      // Создаем runtime
      const runtime: ScriptInstanceRuntime = {
        id: instanceId,
        scriptId: script.id,
        context,
        instance,
        state,
        enabled: true,
        createdAt: Date.now(),
      };

      this.instances.set(instanceId, runtime);

      // Вызываем onEnable
      if (instance.onEnable) {
        instance.onEnable();
      }

      this.emit('instance:created', { instanceId, scriptName, object });

      return instanceId;
    } catch (error) {
      console.error(`[ScriptEngine] Failed to create instance of ${scriptName}:`, error);
      this.emit('instance:error', { scriptName, error });
      return null;
    }
  }

  private createScriptContext(object: any, state: Record<string, any>): ScriptContext {
    const self = this;

    // Создаем систему событий для этого инстанса
    const instanceEvents = new Map<string, Set<Function>>();

    const events: ScriptEvents = {
      on: (event: string, callback: Function) => {
        if (!instanceEvents.has(event)) {
          instanceEvents.set(event, new Set());
        }
        instanceEvents.get(event)!.add(callback);
      },

      off: (event: string, callback: Function) => {
        instanceEvents.get(event)?.delete(callback);
      },

      emit: (event: string, data?: any) => {
        // Сначала вызываем локальные обработчики
        const localCallbacks = instanceEvents.get(event);
        if (localCallbacks) {
          for (const callback of localCallbacks) {
            try {
              callback(data);
            } catch (error) {
              console.error(`[ScriptEngine] Error in event handler for ${event}:`, error);
            }
          }
        }

        // Затем глобальные
        self.emitScriptEvent(event, data);
      },
    };

    return {
      state,
      object,
      events,
      game: this.apis.get('game') || {},
      THREE: this.apis.get('THREE') || {},
      deltaTime: 0,
      time: 0,
    };
  }

  // ==================== Управление инстансами (продолжение) ====================

  destroyInstance(instanceId: string): boolean {
    const runtime = this.instances.get(instanceId);

    if (!runtime) {
      return false;
    }

    try {
      // Вызываем cleanup
      if (runtime.instance.onDisable) {
        runtime.instance.onDisable();
      }
      if (runtime.instance.onDestroy) {
        runtime.instance.onDestroy();
      }

      this.instances.delete(instanceId);

      this.emit('instance:destroyed', { instanceId });

      return true;
    } catch (error) {
      console.error(`[ScriptEngine] Failed to destroy instance ${instanceId}:`, error);
      return false;
    }
  }

  enableInstance(instanceId: string): boolean {
    const runtime = this.instances.get(instanceId);

    if (!runtime || runtime.enabled) {
      return false;
    }

    runtime.enabled = true;

    if (runtime.instance.onEnable) {
      runtime.instance.onEnable();
    }

    this.emit('instance:enabled', { instanceId });

    return true;
  }

  disableInstance(instanceId: string): boolean {
    const runtime = this.instances.get(instanceId);

    if (!runtime || !runtime.enabled) {
      return false;
    }

    runtime.enabled = false;

    if (runtime.instance.onDisable) {
      runtime.instance.onDisable();
    }

    this.emit('instance:disabled', { instanceId });

    return true;
  }

  getInstance(instanceId: string): ScriptInstanceRuntime | null {
    return this.instances.get(instanceId) || null;
  }

  getInstancesByScript(scriptName: string): ScriptInstanceRuntime[] {
    const script = this.scripts.get(scriptName);
    if (!script) return [];

    return Array.from(this.instances.values())
      .filter(runtime => runtime.scriptId === script.id);
  }

  getInstancesByObject(object: any): ScriptInstanceRuntime[] {
    return Array.from(this.instances.values())
      .filter(runtime => runtime.context.object === object);
  }

  // ==================== Обновление инстансов ====================

  updateInstances(deltaTime: number, time: number) {
    for (const [instanceId, runtime] of this.instances) {
      if (!runtime.enabled) continue;

      // Обновляем время в контексте
      runtime.context.deltaTime = deltaTime;
      runtime.context.time = time;

      try {
        if (runtime.instance.update) {
          runtime.instance.update(deltaTime);
        }
      } catch (error) {
        console.error(`[ScriptEngine] Error in update of instance ${instanceId}:`, error);
        this.emit('instance:update-error', { instanceId, error });
      }
    }
  }

  fixedUpdateInstances(fixedDeltaTime: number) {
    for (const [instanceId, runtime] of this.instances) {
      if (!runtime.enabled) continue;

      try {
        if (runtime.instance.fixedUpdate) {
          runtime.instance.fixedUpdate(fixedDeltaTime);
        }
      } catch (error) {
        console.error(`[ScriptEngine] Error in fixedUpdate of instance ${instanceId}:`, error);
      }
    }
  }

  lateUpdateInstances(deltaTime: number) {
    for (const [instanceId, runtime] of this.instances) {
      if (!runtime.enabled) continue;

      try {
        if (runtime.instance.lateUpdate) {
          runtime.instance.lateUpdate(deltaTime);
        }
      } catch (error) {
        console.error(`[ScriptEngine] Error in lateUpdate of instance ${instanceId}:`, error);
      }
    }
  }

  // ==================== Система событий ====================

  emitScriptEvent(event: string, data?: any) {
    const callbacks = this.eventBus.get(event);

    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[ScriptEngine] Error in global event handler for ${event}:`, error);
        }
      }
    }

    this.emit('script-event', { event, data });
  }

  onScriptEvent(event: string, callback: Function) {
    if (!this.eventBus.has(event)) {
      this.eventBus.set(event, new Set());
    }
    this.eventBus.get(event)!.add(callback);
  }

  offScriptEvent(event: string, callback: Function) {
    this.eventBus.get(event)?.delete(callback);
  }

  // ==================== Утилиты ====================

  getScriptInfo(scriptName: string): CompiledScript | null {
    return this.scripts.get(scriptName) || null;
  }

  getAllScripts(): string[] {
    return Array.from(this.scripts.keys());
  }

  getScriptSource(scriptName: string): string | null {
    return this.scriptCache.get(scriptName) || null;
  }

  validateScript(source: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Проверяем синтаксис
      new Function(source);

      // Проверяем наличие setup
      if (!source.includes('setup') && !source.includes('export default')) {
        errors.push('Script must export a default object with setup function');
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push((error as Error).message);
      return { valid: false, errors };
    }
  }

  private generateId(): string {
    return `script_${Date.now()}_${++this.scriptCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Очистка ====================

  destroy() {
    // Уничтожаем все инстансы
    for (const [instanceId, runtime] of this.instances) {
      this.destroyInstance(instanceId);
    }

    this.instances.clear();
    this.scripts.clear();
    this.scriptCache.clear();
    this.eventBus.clear();
    this.apis.clear();

    this.removeAllListeners();

    console.log('[ScriptEngine] Destroyed');
  }

  // ==================== Статистика ====================

  getStats() {
    return {
      scripts: this.scripts.size,
      instances: this.instances.size,
      activeInstances: Array.from(this.instances.values()).filter(i => i.enabled).length,
      apis: this.apis.size,
      events: this.eventBus.size,
    };
  }
}
