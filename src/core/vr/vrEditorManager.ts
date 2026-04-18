// core/vr/VREditorManager.ts
import { EventEmitter } from 'events';
import * as THREE from 'three';
import { SceneManager } from '../scene/SceneManager';
import { AnySceneObject, Transform, PrimitiveType, LightType } from '../scene/types';
import {XrInteractionManager} from "@/core/vr/xr-interation-manager/xrInteractionManager";

export interface VREditorState {
  mode: 'select' | 'add' | 'transform' | 'material' | 'delete';
  selectedObjectId: string | null;
  addObjectType: 'primitive' | 'light' | 'model' | 'effect' | null;
  addObjectSubType: string | null;
  transformMode: 'translate' | 'rotate' | 'scale';
  snapEnabled: boolean;
  snapValue: number;
  isMenuOpen: boolean;
  activeMenu: 'main' | 'scenes' | 'add' | 'materials' | 'settings' | null;
}

export interface VRMenuButton {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface VRTool {
  id: string;
  name: string;
  icon: string;
  activate: () => void;
  deactivate: () => void;
  update?: (deltaTime: number, controllers: any) => void;
}

export class VREditorManager extends EventEmitter {
  private static instance: VREditorManager;

  private sceneManager: SceneManager;

  private state: VREditorState = {
    mode: 'select',
    selectedObjectId: null,
    addObjectType: null,
    addObjectSubType: null,
    transformMode: 'translate',
    snapEnabled: true,
    snapValue: 0.25,
    isMenuOpen: true,
    activeMenu: 'main',
  };

  private tools: Map<string, VRTool> = new Map();
  private activeTool: VRTool | null = null;

  private tempVector = new THREE.Vector3();
  private tempEuler = new THREE.Euler();
  private tempQuaternion = new THREE.Quaternion();
  private tempMatrix = new THREE.Matrix4();

  private raycaster = new THREE.Raycaster();
  private interactionManager = XrInteractionManager;

  private constructor() {
    super();
    this.sceneManager = SceneManager.getInstance();
    this.initializeTools();
    this.setupEventListeners();
  }

  static getInstance(): VREditorManager {
    if (!VREditorManager.instance) {
      VREditorManager.instance = new VREditorManager();
    }
    return VREditorManager.instance;
  }

  // ==================== Инициализация ====================

  private initializeTools() {
    // Инструмент выделения
    this.registerTool({
      id: 'select',
      name: 'Выделение',
      icon: '👆',
      activate: () => {
        this.state.mode = 'select';
      },
      deactivate: () => {},
    });

    // Инструмент перемещения
    this.registerTool({
      id: 'translate',
      name: 'Перемещение',
      icon: '↔️',
      activate: () => {
        this.state.mode = 'transform';
        this.state.transformMode = 'translate';
      },
      deactivate: () => {},
      update: (deltaTime, controllers) => {
        this.handleTransformUpdate('translate', controllers);
      },
    });

    // Инструмент поворота
    this.registerTool({
      id: 'rotate',
      name: 'Поворот',
      icon: '🔄',
      activate: () => {
        this.state.mode = 'transform';
        this.state.transformMode = 'rotate';
      },
      deactivate: () => {},
      update: (deltaTime, controllers) => {
        this.handleTransformUpdate('rotate', controllers);
      },
    });

    // Инструмент масштаба
    this.registerTool({
      id: 'scale',
      name: 'Масштаб',
      icon: '📐',
      activate: () => {
        this.state.mode = 'transform';
        this.state.transformMode = 'scale';
      },
      deactivate: () => {},
      update: (deltaTime, controllers) => {
        this.handleTransformUpdate('scale', controllers);
      },
    });

    // Инструмент добавления
    this.registerTool({
      id: 'add',
      name: 'Добавить',
      icon: '➕',
      activate: () => {
        this.state.mode = 'add';
        this.state.activeMenu = 'add';
      },
      deactivate: () => {},
    });
  }

  private setupEventListeners() {
    // Подписываемся на выбор объектов через InteractionManager
    // this.interactionManager.on('object:selected', (data: any) => {
    //   if (this.state.mode === 'select') {
    //     this.selectObject(data.objectId);
    //   }
    // });

    // Подписываемся на изменения сцены
    this.sceneManager.on('remote:object:added', (object: AnySceneObject) => {
      this.emit('object:added', object);
    });

    this.sceneManager.on('remote:object:removed', (objectId: string) => {
      if (this.state.selectedObjectId === objectId) {
        this.selectObject(null);
      }
      this.emit('object:removed', objectId);
    });

    this.sceneManager.on('remote:object:updated', (objectId: string, updates: any) => {
      this.emit('object:updated', { objectId, updates });
    });
  }

  // ==================== Управление инструментами ====================

  registerTool(tool: VRTool) {
    this.tools.set(tool.id, tool);
    this.emit('tool:registered', tool);
  }

  activateTool(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;

    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    this.activeTool = tool;
    tool.activate();

    this.emit('tool:activated', tool);

    return true;
  }

  getActiveTool(): VRTool | null {
    return this.activeTool;
  }

  // ==================== Управление объектами ====================

  selectObject(objectId: string | null) {
    this.state.selectedObjectId = objectId;

    // Отправляем информацию о выделении другим клиентам
    this.sceneManager.sendSelectionUpdate(objectId);

    this.emit('object:selected', objectId);
  }

  getSelectedObject(): AnySceneObject | null {
    if (!this.state.selectedObjectId) return null;
    return this.sceneManager.getObjectById(this.state.selectedObjectId);
  }

  // ==================== Добавление объектов ====================

  startAddingObject(type: 'primitive' | 'light' | 'model' | 'effect', subType?: string) {
    this.state.mode = 'add';
    this.state.addObjectType = type;
    this.state.addObjectSubType = subType || null;

    this.emit('adding:started', { type, subType });
  }

  confirmAddObject(position: THREE.Vector3, rotation?: THREE.Euler) {
    if (!this.state.addObjectType) return null;

    const objectData: Partial<AnySceneObject> = {
      name: `New_${this.state.addObjectType}_${Date.now()}`,
      transform: {
        position: [position.x, position.y, position.z],
        rotation: rotation ? [rotation.x, rotation.y, rotation.z] : [0, 0, 0],
        scale: [1, 1, 1],
      },
    };

    if (this.state.addObjectType === 'primitive') {
      Object.assign(objectData, {
        type: 'primitive',
        primitiveType: (this.state.addObjectSubType as PrimitiveType) || 'cube',
        params: this.getDefaultPrimitiveParams(this.state.addObjectSubType as PrimitiveType),
        color: '#ffffff',
      });
    } else if (this.state.addObjectType === 'light') {
      Object.assign(objectData, {
        type: 'light',
        lightType: (this.state.addObjectSubType as LightType) || 'point',
        params: {
          color: '#ffffff',
          intensity: 1,
          castShadow: false,
        },
      });
    }

    const objectId = this.sceneManager.addObject(objectData);

    this.state.mode = 'select';
    this.state.addObjectType = null;
    this.state.addObjectSubType = null;

    this.selectObject(objectId);
    this.emit('adding:completed', { objectId });

    return objectId;
  }

  cancelAddObject() {
    this.state.mode = 'select';
    this.state.addObjectType = null;
    this.state.addObjectSubType = null;
    this.emit('adding:cancelled');
  }

  private getDefaultPrimitiveParams(type: PrimitiveType): any {
    switch (type) {
      case 'cube':
        return { width: 1, height: 1, depth: 1 };
      case 'sphere':
        return { radius: 0.5 };
      case 'cylinder':
        return { radiusTop: 0.5, radiusBottom: 0.5, height: 1 };
      case 'plane':
        return { width: 1, height: 1 };
      case 'torus':
        return { radius: 0.5, tubeRadius: 0.1 };
      case 'cone':
        return { radius: 0.5, height: 1 };
      default:
        return {};
    }
  }

  // ==================== Трансформация объектов ====================

  private handleTransformUpdate(mode: 'translate' | 'rotate' | 'scale', controllers: any) {
    if (!this.state.selectedObjectId) return;
    if (this.state.mode !== 'transform') return;

    // Здесь будет логика обновления трансформации через контроллеры
    // Вызывается из игрового цикла VR
  }

  transformSelectedObject(transform: Partial<Transform>) {
    if (!this.state.selectedObjectId) return;

    const object = this.sceneManager.getObjectById(this.state.selectedObjectId);
    if (!object || object.locked) return;

    // Применяем snapping если нужно
    if (this.state.snapEnabled) {
      transform = this.applySnapping(transform, this.state.transformMode);
    }

    this.sceneManager.transformObject(this.state.selectedObjectId, transform);
  }

  private applySnapping(transform: Partial<Transform>, mode: string): Partial<Transform> {
    const snap = this.state.snapValue;
    const snapped = { ...transform };

    if (mode === 'translate' && snapped.position) {
      snapped.position = snapped.position.map(v => Math.round(v / snap) * snap) as [number, number, number];
    } else if (mode === 'rotate' && snapped.rotation) {
      const angleSnap = snap * 15; // 15 градусов
      snapped.rotation = snapped.rotation.map(v => Math.round(v / angleSnap) * angleSnap) as [number, number, number];
    } else if (mode === 'scale' && snapped.scale) {
      snapped.scale = snapped.scale.map(v => Math.round(v / snap) * snap) as [number, number, number];
    }

    return snapped;
  }

  // ==================== Удаление объектов ====================

  deleteSelectedObject() {
    if (!this.state.selectedObjectId) return false;

    this.sceneManager.removeObject(this.state.selectedObjectId);
    this.selectObject(null);

    return true;
  }

  // ==================== Дублирование объектов ====================

  duplicateSelectedObject(): string | null {
    if (!this.state.selectedObjectId) return null;

    const object = this.sceneManager.getObjectById(this.state.selectedObjectId);
    if (!object) return null;

    const duplicated = JSON.parse(JSON.stringify(object));
    duplicated.name = `${object.name}_copy`;
    duplicated.transform.position[0] += 1;

    const newId = this.sceneManager.addObject(duplicated, object.parentId);
    this.selectObject(newId);

    return newId;
  }

  // ==================== Управление материалами ====================

  assignMaterialToSelected(materialId: string) {
    if (!this.state.selectedObjectId) return;

    this.sceneManager.updateObject(this.state.selectedObjectId, {
      materialId,
    } as any);
  }

  // ==================== Навигация по меню ====================

  openMenu(menuId: VREditorState['activeMenu']) {
    this.state.isMenuOpen = true;
    this.state.activeMenu = menuId;
    this.emit('menu:opened', menuId);
  }

  closeMenu() {
    this.state.isMenuOpen = false;
    this.state.activeMenu = null;
    this.emit('menu:closed');
  }

  toggleMenu() {
    if (this.state.isMenuOpen) {
      this.closeMenu();
    } else {
      this.openMenu('main');
    }
  }

  // ==================== Управление сценами ====================

  async createNewScene(name: string): Promise<string> {
    const scene = this.sceneManager.createScene(name);
    await this.sceneManager.saveScene();
    this.emit('scene:created', scene);
    return scene.id;
  }

  async loadScene(sceneId: string): Promise<void> {
    this.selectObject(null);
    await this.sceneManager.loadScene(sceneId);
    this.emit('scene:loaded', sceneId);
  }

  async saveCurrentScene(): Promise<void> {
    await this.sceneManager.saveScene();
    this.emit('scene:saved');
  }

  // ==================== Состояние ====================

  getState(): VREditorState {
    return { ...this.state };
  }

  isInAddMode(): boolean {
    return this.state.mode === 'add';
  }

  getAddObjectInfo() {
    return {
      type: this.state.addObjectType,
      subType: this.state.addObjectSubType,
    };
  }

  // ==================== Геттеры для меню ====================

  getMainMenuButtons(): VRMenuButton[] {
    return [
      {
        id: 'select',
        label: 'Выделение',
        icon: '👆',
        action: () => this.activateTool('select'),
        variant: this.state.mode === 'select' ? 'primary' : 'secondary',
      },
      {
        id: 'translate',
        label: 'Перемещение',
        icon: '↔️',
        action: () => this.activateTool('translate'),
        variant: this.state.mode === 'transform' && this.state.transformMode === 'translate' ? 'primary' : 'secondary',
      },
      {
        id: 'rotate',
        label: 'Поворот',
        icon: '🔄',
        action: () => this.activateTool('rotate'),
        variant: this.state.mode === 'transform' && this.state.transformMode === 'rotate' ? 'primary' : 'secondary',
      },
      {
        id: 'scale',
        label: 'Масштаб',
        icon: '📐',
        action: () => this.activateTool('scale'),
        variant: this.state.mode === 'transform' && this.state.transformMode === 'scale' ? 'primary' : 'secondary',
      },
      {
        id: 'add',
        label: 'Добавить',
        icon: '➕',
        action: () => this.openMenu('add'),
      },
      {
        id: 'duplicate',
        label: 'Дублировать',
        icon: '📋',
        action: () => this.duplicateSelectedObject(),
        disabled: !this.state.selectedObjectId,
      },
      {
        id: 'delete',
        label: 'Удалить',
        icon: '🗑️',
        action: () => this.deleteSelectedObject(),
        variant: 'danger',
        disabled: !this.state.selectedObjectId,
      },
      {
        id: 'scenes',
        label: 'Сцены',
        icon: '📁',
        action: () => this.openMenu('scenes'),
      },
      {
        id: 'settings',
        label: 'Настройки',
        icon: '⚙️',
        action: () => this.openMenu('settings'),
      },
    ];
  }

  getAddMenuButtons(): VRMenuButton[] {
    return [
      {
        id: 'back',
        label: '← Назад',
        action: () => this.openMenu('main'),
      },
      {
        id: 'add-cube',
        label: 'Куб',
        icon: '📦',
        action: () => this.startAddingObject('primitive', 'cube'),
      },
      {
        id: 'add-sphere',
        label: 'Сфера',
        icon: '⚪',
        action: () => this.startAddingObject('primitive', 'sphere'),
      },
      {
        id: 'add-cylinder',
        label: 'Цилиндр',
        icon: '🥫',
        action: () => this.startAddingObject('primitive', 'cylinder'),
      },
      {
        id: 'add-plane',
        label: 'Плоскость',
        icon: '⬜',
        action: () => this.startAddingObject('primitive', 'plane'),
      },
      {
        id: 'add-light-point',
        label: 'Точечный свет',
        icon: '💡',
        action: () => this.startAddingObject('light', 'point'),
      },
      {
        id: 'add-light-directional',
        label: 'Направленный свет',
        icon: '☀️',
        action: () => this.startAddingObject('light', 'directional'),
      },
      {
        id: 'cancel',
        label: 'Отмена',
        action: () => this.cancelAddObject(),
        variant: 'danger',
      },
    ];
  }

  // ==================== Обновление ====================

  update(deltaTime: number, controllers: any) {
    if (this.activeTool?.update) {
      this.activeTool.update(deltaTime, controllers);
    }
  }
}
