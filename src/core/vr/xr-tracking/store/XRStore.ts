import * as THREE from 'three';

// Типы для контроллеров
export interface ControllerButtonState {
  value: number;
  pressed: boolean;
  touched: boolean;
}

export interface ControllerThumbstickState {
  x: number;
  y: number;
  pressed: boolean;
  touched: boolean;
}

export interface ControllerState {
  handedness: XRHandedness;
  gripPosition: THREE.Vector3;
  gripQuaternion: THREE.Quaternion;
  targetRayPosition: THREE.Vector3;
  targetRayQuaternion: THREE.Quaternion;
  // Кнопки (индексы могут отличаться для разных контроллеров)
  buttons: {
    trigger: ControllerButtonState;
    grip: ControllerButtonState;  // захват
    a?: ControllerButtonState;
    b?: ControllerButtonState;
    x?: ControllerButtonState;
    y?: ControllerButtonState;
  };
  // Джойстик
  thumbstick: ControllerThumbstickState;
  // Дополнительная информация
  gamepad: Gamepad | null;
  profiles: string[];
  isConnected: boolean;
  lastSeen: number;
}

// Типы для головы
export interface HeadState {
  leftPosition: THREE.Vector3;
  rightPosition: THREE.Vector3;
  centerPosition: THREE.Vector3;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

// Единое хранилище
export class XRStore {
  private static instance: XRStore;

  // Состояния
  public controllers = {
    left: null as ControllerState | null,
    right: null as ControllerState | null,
  } as Record<XRHandedness, ControllerState | null>;

  public head: HeadState | null = null;

  // Версии для оптимизации
  private versions = {
    controllers: 0,
    head: 0,
  };

  // Слушатели по типам
  private listeners = {
    controllers: new Set<() => void>(),
    head: new Set<() => void>(),
  };

  static getInstance(): XRStore {
    if (!XRStore.instance) {
      XRStore.instance = new XRStore();
    }
    return XRStore.instance;
  }

  // Подписка на конкретный тип
  subscribe(type: 'controllers' | 'head', listener: () => void): () => void {
    this.listeners[type].add(listener);
    return () => {
      this.listeners[type].delete(listener);
    };
  }

  // Уведомление слушателей конкретного типа
  notify(type: 'controllers' | 'head') {
    this.versions[type]++;
    this.listeners[type].forEach(listener => listener());
  }

  // Получение версии для оптимизации
  getVersion(type: 'controllers' | 'head'): number {
    return this.versions[type];
  }

  // Сброс всех состояний
  reset() {
    this.controllers.left = null;
    this.controllers.right = null;
    this.head = null;

    Object.keys(this.versions).forEach(key => {
      this.versions[key as keyof typeof this.versions]++;
    });

    ['controllers', 'head'].forEach(type => {
      this.notify(type as any);
    });
  }
}
