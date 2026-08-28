// app/editor/scenes/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SceneManager } from '@/core/scene/SceneManager';
import { useScenes} from "@/api/scenes/useScenes";
import { useModels } from '@/api/models/useModels';
import { useMaterials } from '@/api/materials/useMaterials';
import {
  AnySceneObject,
  SceneData,
  PrimitiveType,
  LightType,
  Transform
} from '@/core/scene/types';
import styles from './page.module.css';

const SceneViewport = dynamic(() => import('@/components/vr/SceneViewport'), {
  ssr: false,
  loading: () => <div className={styles.viewportLoading}>Загрузка 3D вьюпорта...</div>,
});

function NumericInput({
  value,
  step = 0.1,
  min,
  onCommit,
}: {
  value: number;
  step?: number;
  min?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    if (draft.trim() === '' || draft === '-' || draft === '.') {
      setDraft(String(value));
      return;
    }
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed) || (min !== undefined && parsed < min)) {
      setDraft(String(value));
      return;
    }
    onCommit(parsed);
    setDraft(String(parsed));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
      step={step}
      min={min}
    />
  );
}

export default function ScenesPage() {
  const router = useRouter();
  const sceneManager = useRef(SceneManager.getInstance()).current;
  const {
    scenes,
    loading,
    error: apiError,
    loadScenes,
    createScene,
    loadScene: loadSceneAPI,
    saveScene: saveSceneAPI,
    deleteScene: deleteSceneAPI
  } = useScenes();

  const [currentScene, setCurrentScene] = useState<SceneData | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapValue, setSnapValue] = useState(0.25);
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
  const [viewPreset, setViewPreset] = useState<'perspective' | 'front' | 'side' | 'top' | 'frame'>('perspective');
  const { models } = useModels();
  const { materials } = useMaterials();

  // Генерация читаемого имени для объекта
  const generateObjectName = useCallback((type: 'primitive' | 'light' | 'folder' | 'model', modelFileName?: string, scene?: SceneData | null) => {
    if (!scene) return `New_${type}`;
    
    let baseName = '';
    
    if (type === 'primitive') {
      baseName = 'Primitive';
    } else if (type === 'light') {
      baseName = 'light';
    } else if (type === 'folder') {
      baseName = 'folder';
    } else if (type === 'model' && modelFileName) {
      baseName = `model_${modelFileName}`;
    }
    
    // Считаем существующие объекты с таким же базовым именем
    const existingNames = Object.values(scene.objects).map(obj => obj.name);
    let counter = 1;
    let name = `${baseName}_${counter}`;
    
    while (existingNames.includes(name)) {
      counter++;
      name = `${baseName}_${counter}`;
    }
    
    return name;
  }, []);

  // Обработка горячих клавиш
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select')) return;
      
      const key = event.key.toLowerCase();
      
      // Гизмо
      if (key === 'g') setGizmoMode('translate');
      if (key === 'r') setGizmoMode('rotate');
      if (key === 's') setGizmoMode('scale');
      if (event.key === 'Escape') setSelectedObjectId(null);
      
      // Удаление
      if (event.key === 'Delete' || event.key === 'Del') {
        event.preventDefault();
        if (selectedObjectId) {
          handleDeleteObject(selectedObjectId);
        }
      }
      
      // Undo/Redo
      if (event.ctrlKey || event.metaKey) {
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
        }
        if (key === 'y' || (key === 'z' && event.shiftKey)) {
          event.preventDefault();
          handleRedo();
        }
      }
    };
    
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [selectedObjectId, gizmoMode, snapEnabled, snapValue]);

  // Загрузка списка сцен при монтировании
  useEffect(() => {
    loadScenes();
  }, []);

  // Подписка на события SceneManager
  useEffect(() => {
    const handleSceneLoaded = (scene: SceneData) => {
      setCurrentScene(scene);
      setSelectedObjectId(null);
      setExpandedObjects(new Set());
    };

    const handleSceneCreated = (scene: SceneData) => {
      setCurrentScene(scene);
      loadScenes();
    };

    const handleSceneSaved = () => {
      setSaving(false);
      loadScenes();
    };

    const handleObjectAdded = () => {
      const updatedScene = sceneManager.getCurrentScene();
      if (updatedScene) {
        setCurrentScene({ ...updatedScene });
      }
    };

    const handleObjectRemoved = (objectId: string) => {
      const updatedScene = sceneManager.getCurrentScene();
      if (updatedScene) {
        setCurrentScene({ ...updatedScene });
      }
      if (selectedObjectId === objectId) {
        setSelectedObjectId(null);
      }
    };

    const handleObjectUpdated = () => {
      const updatedScene = sceneManager.getCurrentScene();
      if (updatedScene) {
        setCurrentScene({ ...updatedScene });
      }
    };

    const handleObjectSelected = (objectId: string) => {
      setSelectedObjectId(objectId);
    };

    const handleSceneError = (err: Error) => {
      setError(err.message);
    };

    const handleSceneUndo = (scene: SceneData) => {
      setCurrentScene({ ...scene });
      setSelectedObjectId(null);
    };

    const handleSceneRedo = (scene: SceneData) => {
      setCurrentScene({ ...scene });
      setSelectedObjectId(null);
    };

    sceneManager.on('scene:loaded', handleSceneLoaded);
    sceneManager.on('scene:created', handleSceneCreated);
    sceneManager.on('scene:saved', handleSceneSaved);
    sceneManager.on('object:added', handleObjectAdded);
    sceneManager.on('object:removed', handleObjectRemoved);
    sceneManager.on('object:updated', handleObjectUpdated);
    sceneManager.on('object:transformed', handleObjectUpdated);
    sceneManager.on('object:selected', handleObjectSelected);
    sceneManager.on('scene:error', handleSceneError);
    sceneManager.on('scene:undo', handleSceneUndo);
    sceneManager.on('scene:redo', handleSceneRedo);

    return () => {
      sceneManager.off('scene:loaded', handleSceneLoaded);
      sceneManager.off('scene:created', handleSceneCreated);
      sceneManager.off('scene:saved', handleSceneSaved);
      sceneManager.off('object:added', handleObjectAdded);
      sceneManager.off('object:removed', handleObjectRemoved);
      sceneManager.off('object:updated', handleObjectUpdated);
      sceneManager.off('object:transformed', handleObjectUpdated);
      sceneManager.off('object:selected', handleObjectSelected);
      sceneManager.off('scene:error', handleSceneError);
      sceneManager.off('scene:undo', handleSceneUndo);
      sceneManager.off('scene:redo', handleSceneRedo);
    };
  }, [sceneManager, loadScenes, selectedObjectId]);

  // Обновление ошибки из API
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  // Создание новой сцены
  const handleCreateScene = async () => {
    if (!newSceneName.trim()) return;

    const result = await createScene(newSceneName.trim(), newSceneDescription.trim() || undefined);

    if (result.success && result.scene) {
      await sceneManager.loadScene(result.scene.id);
      setCurrentScene(result.scene);
      setShowCreateDialog(false);
      setNewSceneName('');
      setNewSceneDescription('');
    }
  };

  // Загрузка сцены
  const handleLoadScene = async (sceneId: string) => {
    const result = await loadSceneAPI(sceneId);

    if (result.success && result.scene) {
      await sceneManager.loadScene(sceneId);
      setCurrentScene(result.scene);
      setSelectedObjectId(null);
      setExpandedObjects(new Set());
    }
  };

  // Сохранение сцены
  const handleSaveScene = async () => {
    if (!currentScene) return;

    setSaving(true);

    const sceneData = sceneManager.getCurrentScene();
    if (!sceneData) {
      setSaving(false);
      return;
    }

    const result = await saveSceneAPI(sceneData);

    if (result.success) {
      setCurrentScene(result.scene);
    }

    setSaving(false);
  };

  // Удаление сцены
  const handleDeleteScene = async (sceneId: string, sceneName: string) => {
    if (!confirm(`Удалить сцену "${sceneName}"?`)) return;

    const result = await deleteSceneAPI(sceneId);

    if (result.success) {
      if (currentScene?.id === sceneId) {
        setCurrentScene(null);
      }
    }
  };

  // Вход в VR редактор
  const handleEditInVR = () => {
    if (currentScene) {
      router.push(`/vr?mode=editor&sceneId=${currentScene.id}`);
    }
  };

  // Добавление объекта
  const handleAddObject = (type: 'primitive' | 'light' | 'folder' | 'model', subType?: string) => {
    if (!currentScene) return;

    let objectName = '';
    let modelFileName = '';
    
    if (type === 'model') {
      const model = models[0];
      if (!model) {
        setError('Сначала загрузите модель в разделе моделей');
        return;
      }
      // Извлекаем имя файла без расширения
      modelFileName = model.name.replace(/\.[^.]+$/, '');
      objectName = generateObjectName(type, modelFileName, currentScene);
    } else {
      objectName = generateObjectName(type, undefined, currentScene);
    }

    let newObject: Partial<AnySceneObject> = {
      name: objectName,
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      visible: true,
      locked: false,
      children: [],
      components: [],
    };

    if (type === 'primitive') {
      newObject = {
        ...newObject,
        type: 'primitive',
        primitiveType: (subType as PrimitiveType) || 'cube',
        params: {},
        color: '#ffffff',
      };
    } else if (type === 'light') {
      const lightParams: Record<string, any> = {
        color: '#ffffff',
        intensity: 1,
        castShadow: false,
      };
      
      if (subType === 'point') {
        lightParams.distance = 10;
        lightParams.decay = 2;
      } else if (subType === 'directional') {
        lightParams.shadowMapSize = 1024;
      } else if (subType === 'spot') {
        lightParams.distance = 20;
        lightParams.decay = 2;
        lightParams.angle = 0.5;
        lightParams.penumbra = 0.3;
      }
      
      newObject = {
        ...newObject,
        type: 'light',
        lightType: (subType as LightType) || 'point',
        params: lightParams,
      };
    } else if (type === 'model') {
      const model = models[0];
      newObject = { 
        ...newObject, 
        type: 'model', 
        modelId: model.id, 
        modelUrl: model.url,
      };
    } else {
      newObject = {
        ...newObject,
        type: 'folder',
      };
    }

    const selectedObject = selectedObjectId ? currentScene.objects[selectedObjectId] : null;
    const parentId = selectedObject?.type === 'folder' && selectedObjectId ? selectedObjectId : undefined;
    const objectId = sceneManager.addObject(newObject, parentId);
    setSelectedObjectId(objectId);

    const updatedScene = sceneManager.getCurrentScene();
    if (updatedScene) {
      setCurrentScene({ ...updatedScene });
    }

    if (parentId) {
      setExpandedObjects(prev => {
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });
    }
  };

  // Удаление объекта
  const handleDeleteObject = (objectId: string) => {
    sceneManager.removeObject(objectId);
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null);
    }

    const updatedScene = sceneManager.getCurrentScene();
    if (updatedScene) {
      setCurrentScene({ ...updatedScene });
    }
  };

  // Дублирование объекта
  const handleDuplicateObject = (objectId: string) => {
    const object = currentScene?.objects[objectId];
    if (!object) return;

    const duplicateBranch = (sourceId: string, parentId?: string): string => {
      const source = currentScene!.objects[sourceId];
      const duplicated = JSON.parse(JSON.stringify(source));
      delete duplicated.id;
      delete duplicated.parentId;
      duplicated.name = `${source.name}_copy`;
      duplicated.children = [];
      if (!parentId) duplicated.transform.position[0] += 1;
      const newId = sceneManager.addObject(duplicated, parentId);
      source.children.forEach(childId => duplicateBranch(childId, newId));
      return newId;
    };

    const newId = duplicateBranch(objectId, object.parentId);
    setSelectedObjectId(newId);

    const updatedScene = sceneManager.getCurrentScene();
    if (updatedScene) {
      setCurrentScene({ ...updatedScene });
    }
  };

  // Обновление трансформации
  const handleTransformChange = (objectId: string, transform: Partial<Transform>) => {
    sceneManager.transformObject(objectId, transform);

    const updatedScene = sceneManager.getCurrentScene();
    if (updatedScene) {
      setCurrentScene({ ...updatedScene });
    }
  };

  // Обновление свойств объекта
  const handlePropertyChange = (objectId: string, updates: Partial<AnySceneObject>) => {
    sceneManager.updateObject(objectId, updates);

    const updatedScene = sceneManager.getCurrentScene();
    if (updatedScene) {
      setCurrentScene({ ...updatedScene });
    }
  };

  const assignMaterial = (objectId: string, materialId: string) => {
    const material = materials.find(item => item.id === materialId);
    handlePropertyChange(objectId, {
      materialId: materialId || undefined,
      materialProperties: material ? { ...material.properties, type: material.type } : undefined,
    } as Partial<AnySceneObject>);
  };

  const handleDropObject = (event: React.DragEvent, targetId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = event.dataTransfer.getData('application/x-scene-object');
    if (!sourceId || sourceId === targetId) return;
    if (!targetId) {
      if (sceneManager.reparentObject(sourceId, null)) {
        const updatedScene = sceneManager.getCurrentScene();
        if (updatedScene) setCurrentScene({ ...updatedScene });
      }
      return;
    }
    const target = currentScene?.objects[targetId];
    const source = currentScene?.objects[sourceId];
    if (!target || !source) return;
    const parentId = target.type === 'folder' ? targetId : (target.parentId || null);
    const siblings = parentId ? currentScene!.objects[parentId].children : currentScene!.rootObjects;
    const targetIndex = target.type === 'folder' ? undefined : siblings.indexOf(targetId);
    if (sceneManager.reparentObject(sourceId, parentId, targetIndex)) {
      const updatedScene = sceneManager.getCurrentScene();
      if (updatedScene) setCurrentScene({ ...updatedScene });
    }
  };

  // Переключение видимости
  const handleToggleVisibility = (objectId: string) => {
    const object = currentScene?.objects[objectId];
    if (object) {
      sceneManager.updateObject(objectId, { visible: !object.visible });

      const updatedScene = sceneManager.getCurrentScene();
      if (updatedScene) {
        setCurrentScene({ ...updatedScene });
      }
    }
  };

  // Отмена действия
  const handleUndo = () => {
    const success = sceneManager.undo();
    if (success) {
      const updatedScene = sceneManager.getCurrentScene();
      if (updatedScene) {
        setCurrentScene({ ...updatedScene });
        setSelectedObjectId(null);
      }
    }
  };

  // Повтор действия
  const handleRedo = () => {
    const success = sceneManager.redo();
    if (success) {
      const updatedScene = sceneManager.getCurrentScene();
      if (updatedScene) {
        setCurrentScene({ ...updatedScene });
        setSelectedObjectId(null);
      }
    }
  };

  // Переключение раскрытия в иерархии
  const toggleExpand = (objectId: string) => {
    const newExpanded = new Set(expandedObjects);
    if (newExpanded.has(objectId)) {
      newExpanded.delete(objectId);
    } else {
      newExpanded.add(objectId);
    }
    setExpandedObjects(newExpanded);
  };

  // Получение иконки объекта
  const getObjectIcon = (object: AnySceneObject): string => {
    switch (object.type) {
      case 'primitive':
        const primObj = object as any;
        switch (primObj.primitiveType) {
          case 'cube': return '📦';
          case 'sphere': return '⚪';
          case 'cylinder': return '🥫';
          case 'plane': return '⬜';
          case 'torus': return '🍩';
          case 'cone': return '🔺';
          default: return '📐';
        }
      case 'model': return '🗿';
      case 'light':
        const lightObj = object as any;
        switch (lightObj.lightType) {
          case 'ambient': return '☀️';
          case 'directional': return '🔦';
          case 'point': return '💡';
          case 'spot': return '🎯';
          default: return '✨';
        }
      case 'effect': return '🌈';
      default: return '📁';
    }
  };

  // Рендер иерархии объектов
  const renderHierarchy = (objectIds: string[], level: number = 0) => {
    if (!currentScene) return null;

    return objectIds.map(objectId => {
      const object = currentScene.objects[objectId];
      if (!object) return null;

      const isSelected = selectedObjectId === objectId;
      const isExpanded = expandedObjects.has(objectId);
      const hasChildren = object.children && object.children.length > 0;

      return (
        <div key={objectId} className={styles.hierarchyItem}>
          <div
            className={`${styles.hierarchyRow} ${isSelected ? styles.selected : ''}`}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
            onClick={() => setSelectedObjectId(objectId)}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/x-scene-object', objectId);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDropObject(event, objectId)}
          >
            <button
              className={styles.expandButton}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(objectId);
              }}
              disabled={!hasChildren}
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
            </button>

            <span className={styles.objectIcon}>
              {getObjectIcon(object)}
            </span>

            <input
              className={styles.objectName}
              value={object.name}
              onChange={(e) => {
                e.stopPropagation();
                handlePropertyChange(objectId, { name: e.target.value });
              }}
              onClick={() => setSelectedObjectId(objectId)}
            />

            <div className={styles.objectActions}>
              <button
                className={styles.visibilityButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleVisibility(objectId);
                }}
                title={object.visible ? 'Скрыть' : 'Показать'}
              >
                {object.visible ? '👁' : '👁‍🗨'}
              </button>

              <button
                className={styles.duplicateButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateObject(objectId);
                }}
                title="Дублировать"
              >
                📋
              </button>
            </div>
          </div>

          {isExpanded && hasChildren && (
            <div className={styles.hierarchyChildren}>
              {renderHierarchy(object.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Рендер инспектора свойств
  const renderInspector = () => {
    if (!selectedObjectId || !currentScene) {
      return (
        <div className={styles.inspectorFolder}>
          <p>Выберите объект для редактирования</p>
        </div>
      );
    }

    const object = currentScene.objects[selectedObjectId];
    if (!object) return null;

    return (
      <div className={styles.inspector}>
        <div className={styles.inspectorHeader}>
          <h3>Инспектор</h3>
          <button
            className={styles.deleteObjectButton}
            onClick={() => handleDeleteObject(selectedObjectId)}
            title="Удалить объект"
          >
            🗑️
          </button>
        </div>

        <div className={styles.inspectorSection}>
          <h4>Transform</h4>

          <div className={styles.transformRow}>
            <label>Position</label>
            <div className={styles.vectorInput}>
              <NumericInput value={object.transform.position[0]} step={snapEnabled ? snapValue : 0.1} onCommit={(value) => handleTransformChange(selectedObjectId, { position: [value, object.transform.position[1], object.transform.position[2]] })} />
              <NumericInput value={object.transform.position[1]} step={snapEnabled ? snapValue : 0.1} onCommit={(value) => handleTransformChange(selectedObjectId, { position: [object.transform.position[0], value, object.transform.position[2]] })} />
              <NumericInput value={object.transform.position[2]} step={snapEnabled ? snapValue : 0.1} onCommit={(value) => handleTransformChange(selectedObjectId, { position: [object.transform.position[0], object.transform.position[1], value] })} />
            </div>
          </div>

          <div className={styles.transformRow}>
            <label>Rotation</label>
            <div className={styles.vectorInput}>
              <NumericInput value={object.transform.rotation[0]} step={snapEnabled ? snapValue * 15 : 1} onCommit={(value) => handleTransformChange(selectedObjectId, { rotation: [value, object.transform.rotation[1], object.transform.rotation[2]] })} />
              <NumericInput value={object.transform.rotation[1]} step={snapEnabled ? snapValue * 15 : 1} onCommit={(value) => handleTransformChange(selectedObjectId, { rotation: [object.transform.rotation[0], value, object.transform.rotation[2]] })} />
              <NumericInput value={object.transform.rotation[2]} step={snapEnabled ? snapValue * 15 : 1} onCommit={(value) => handleTransformChange(selectedObjectId, { rotation: [object.transform.rotation[0], object.transform.rotation[1], value] })} />
            </div>
          </div>

          <div className={styles.transformRow}>
            <label>Scale</label>
            <div className={styles.vectorInput}>
              <NumericInput value={object.transform.scale[0]} step={0.1} min={0.01} onCommit={(value) => handleTransformChange(selectedObjectId, { scale: [value, object.transform.scale[1], object.transform.scale[2]] })} />
              <NumericInput value={object.transform.scale[1]} step={0.1} min={0.01} onCommit={(value) => handleTransformChange(selectedObjectId, { scale: [object.transform.scale[0], value, object.transform.scale[2]] })} />
              <NumericInput value={object.transform.scale[2]} step={0.1} min={0.01} onCommit={(value) => handleTransformChange(selectedObjectId, { scale: [object.transform.scale[0], object.transform.scale[1], value] })} />
            </div>
          </div>
        </div>

        {object.type === 'primitive' && (
          <div className={styles.inspectorSection}>
            <h4>Primitive</h4>

            <div className={styles.propertyRow}>
              <label>Type</label>
              <select
                value={(object as any).primitiveType}
                onChange={(e) => handlePropertyChange(selectedObjectId, { primitiveType: e.target.value as PrimitiveType | undefined })}
              >
                <option value="cube">Cube</option>
                <option value="sphere">Sphere</option>
                <option value="cylinder">Cylinder</option>
                <option value="plane">Plane</option>
                <option value="torus">Torus</option>
                <option value="cone">Cone</option>
              </select>
            </div>

            <div className={styles.propertyRow}>
              <label>Color</label>
              <input
                type="color"
                value={(object as any).color || '#ffffff'}
                onChange={(e) => handlePropertyChange(selectedObjectId, { color: e.target.value })}
              />
            </div>

            {(object as any).primitiveType === 'cube' && (
              <>
                <div className={styles.propertyRow}>
                  <label>Width</label>
                  <input
                    type="number"
                    value={(object as any).params?.width || 1}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, width: parseFloat(e.target.value) || 1 }
                    })}
                    step={0.1}
                    min={0.1}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Height</label>
                  <input
                    type="number"
                    value={(object as any).params?.height || 1}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, height: parseFloat(e.target.value) || 1 }
                    })}
                    step={0.1}
                    min={0.1}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Depth</label>
                  <input
                    type="number"
                    value={(object as any).params?.depth || 1}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, depth: parseFloat(e.target.value) || 1 }
                    })}
                    step={0.1}
                    min={0.1}
                  />
                </div>
              </>
            )}

            {(object as any).primitiveType === 'sphere' && (
              <div className={styles.propertyRow}>
                <label>Radius</label>
                <input
                  type="number"
                  value={(object as any).params?.radius || 0.5}
                  onChange={(e) => handlePropertyChange(selectedObjectId, {
                    params: { ...(object as any).params, radius: parseFloat(e.target.value) || 0.5 }
                  })}
                  step={0.1}
                  min={0.1}
                />
              </div>
            )}

            {(object as any).primitiveType === 'cylinder' && (
              <>
                <div className={styles.propertyRow}>
                  <label>Radius Top</label>
                  <input
                    type="number"
                    value={(object as any).params?.radiusTop || 0.5}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, radiusTop: parseFloat(e.target.value) || 0.5 }
                    })}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Radius Bottom</label>
                  <input
                    type="number"
                    value={(object as any).params?.radiusBottom || 0.5}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, radiusBottom: parseFloat(e.target.value) || 0.5 }
                    })}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Height</label>
                  <input
                    type="number"
                    value={(object as any).params?.height || 1}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, height: parseFloat(e.target.value) || 1 }
                    })}
                    step={0.1}
                    min={0.1}
                  />
                </div>
              </>
            )}

            {(object as any).primitiveType === 'torus' && (
              <>
                <div className={styles.propertyRow}>
                  <label>Radius</label>
                  <input
                    type="number"
                    value={(object as any).params?.radius || 0.5}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, radius: parseFloat(e.target.value) || 0.5 }
                    })}
                    step={0.1}
                    min={0.1}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Tube Radius</label>
                  <input
                    type="number"
                    value={(object as any).params?.tubeRadius || 0.1}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, tubeRadius: parseFloat(e.target.value) || 0.1 }
                    })}
                    step={0.05}
                    min={0.01}
                  />
                </div>
              </>
            )}

            {(object as any).primitiveType === 'cone' && (
              <>
                <div className={styles.propertyRow}>
                  <label>Radius</label>
                  <input
                    type="number"
                    value={(object as any).params?.radius || 0.5}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, radius: parseFloat(e.target.value) || 0.5 }
                    })}
                    step={0.1}
                    min={0.1}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Height</label>
                  <input
                    type="number"
                    value={(object as any).params?.height || 1}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, height: parseFloat(e.target.value) || 1 }
                    })}
                    step={0.1}
                    min={0.1}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {object.type === 'light' && (
          <div className={styles.inspectorSection}>
            <h4>Light</h4>

            <div className={styles.propertyRow}>
              <label>Type</label>
              <select
                value={(object as any).lightType}
                onChange={(e) => {
                  const lightType = e.target.value as LightType;
                  const newParams: Record<string, any> = {
                    color: (object as any).params?.color || '#ffffff',
                    intensity: (object as any).params?.intensity || 1,
                    castShadow: (object as any).params?.castShadow || false,
                  };
                  
                  if (lightType === 'point') {
                    newParams.distance = 10;
                    newParams.decay = 2;
                  } else if (lightType === 'directional') {
                    newParams.shadowMapSize = 1024;
                  } else if (lightType === 'spot') {
                    newParams.distance = 20;
                    newParams.decay = 2;
                    newParams.angle = 0.5;
                    newParams.penumbra = 0.3;
                  }
                  
                  handlePropertyChange(selectedObjectId, {
                    lightType,
                    params: newParams,
                  } as Partial<AnySceneObject>);
                }}
              >
                <option value="ambient">Ambient</option>
                <option value="directional">Directional</option>
                <option value="point">Point</option>
                <option value="spot">Spot</option>
              </select>
            </div>

            <div className={styles.propertyRow}>
              <label>Color</label>
              <input
                type="color"
                value={(object as any).params?.color || '#ffffff'}
                onChange={(e) => handlePropertyChange(selectedObjectId, {
                  params: { ...(object as any).params, color: e.target.value }
                })}
              />
            </div>

            <div className={styles.propertyRow}>
              <label>Intensity</label>
              <input
                type="number"
                value={(object as any).params?.intensity || 1}
                onChange={(e) => handlePropertyChange(selectedObjectId, {
                  params: { ...(object as any).params, intensity: parseFloat(e.target.value) || 1 }
                })}
                step={0.1}
                min={0}
              />
            </div>

            {((object as any).lightType === 'point' || (object as any).lightType === 'spot') && (
              <>
                <div className={styles.propertyRow}>
                  <label>Distance</label>
                  <input
                    type="number"
                    value={(object as any).params?.distance || 10}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, distance: parseFloat(e.target.value) || 0 }
                    })}
                    step={1}
                    min={0}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Decay</label>
                  <input
                    type="number"
                    value={(object as any).params?.decay || 2}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, decay: parseFloat(e.target.value) || 0 }
                    })}
                    step={0.1}
                    min={0}
                  />
                </div>
              </>
            )}

            {(object as any).lightType === 'spot' && (
              <>
                <div className={styles.propertyRow}>
                  <label>Angle</label>
                  <input
                    type="number"
                    value={(object as any).params?.angle || 0.5}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, angle: parseFloat(e.target.value) || 0.5 }
                    })}
                    step={0.1}
                    min={0.1}
                    max={Math.PI / 2}
                  />
                </div>
                <div className={styles.propertyRow}>
                  <label>Penumbra</label>
                  <input
                    type="number"
                    value={(object as any).params?.penumbra || 0.3}
                    onChange={(e) => handlePropertyChange(selectedObjectId, {
                      params: { ...(object as any).params, penumbra: parseFloat(e.target.value) || 0 }
                    })}
                    step={0.1}
                    min={0}
                    max={1}
                  />
                </div>
              </>
            )}

            {(object as any).lightType === 'directional' && (
              <div className={styles.propertyRow}>
                <label>Shadow Map Size</label>
                <select
                  value={(object as any).params?.shadowMapSize || 1024}
                  onChange={(e) => handlePropertyChange(selectedObjectId, {
                    params: { ...(object as any).params, shadowMapSize: parseInt(e.target.value) }
                  })}
                >
                  <option value="512">512</option>
                  <option value="1024">1024</option>
                  <option value="2048">2048</option>
                  <option value="4096">4096</option>
                </select>
              </div>
            )}

            <div className={styles.propertyRow}>
              <label>
                <input
                  type="checkbox"
                  checked={(object as any).params?.castShadow || false}
                  onChange={(e) => handlePropertyChange(selectedObjectId, {
                    params: { ...(object as any).params, castShadow: e.target.checked }
                  })}
                />
                Cast Shadow
              </label>
            </div>
          </div>
        )}

        {object.type === 'model' && (
          <div className={styles.inspectorSection}>
            <h4>Model</h4>
            <div className={styles.propertyRow}>
              <label>Asset</label>
              <select
                value={(object as any).modelId || ''}
                onChange={(event) => {
                  const model = models.find(item => item.id === event.target.value);
                  if (model) {
                    handlePropertyChange(selectedObjectId, {
                      modelId: model.id,
                      modelUrl: model.url,
                      name: model.name,
                    } as Partial<AnySceneObject>);
                  }
                }}
              >
                <option value="">Выберите модель</option>
                {models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {(object.type === 'primitive' || object.type === 'model') && (
          <div className={styles.inspectorSection}>
            <h4>Material</h4>
            <select
              value={(object as any).materialId || ''}
              onChange={(event) => assignMaterial(selectedObjectId, event.target.value)}
            >
              <option value="">Материал по умолчанию</option>
              {materials.map(material => (
                <option key={material.id} value={material.id}>{material.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };

  // Если сцена не выбрана, показываем список сцен
  if (!currentScene) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Сцены</h1>
          <button
            className={styles.createButton}
            onClick={() => setShowCreateDialog(true)}
          >
            + Новая сцена
          </button>
        </div>

        {showCreateDialog && (
          <div className={styles.dialogOverlay} onClick={() => setShowCreateDialog(false)}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
              <h3>Создать новую сцену</h3>
              <input
                type="text"
                placeholder="Название сцены"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                placeholder="Описание (необязательно)"
                value={newSceneDescription}
                onChange={(e) => setNewSceneDescription(e.target.value)}
              />
              <div className={styles.dialogActions}>
                <button onClick={() => setShowCreateDialog(false)}>Отмена</button>
                <button onClick={handleCreateScene}>Создать</button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.scenesList}>
          {loading ? (
            <div className={styles.loading}>Загрузка сцен...</div>
          ) : scenes.length === 0 ? (
            <div className={styles.folder}>
              <p>Нет сцен. Создайте первую сцену.</p>
            </div>
          ) : (
            scenes.map(scene => (
              <div key={scene.id} className={styles.sceneCard}>
                <div className={styles.scenePreview}>
                  {scene.metadata.thumbnail ? (
                    <img src={scene.metadata.thumbnail} alt={scene.name} />
                  ) : (
                    <div className={styles.scenePlaceholder}>🎬</div>
                  )}
                </div>
                <div className={styles.sceneInfo}>
                  <h3>{scene.name}</h3>
                  {scene.description && <p>{scene.description}</p>}
                  <div className={styles.sceneMeta}>
                    <span>Версия: {scene.metadata.version}</span>
                    <span>Обновлено: {new Date(scene.metadata.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className={styles.sceneActions}>
                  <button onClick={() => handleLoadScene(scene.id)}>Открыть</button>
                  <button onClick={() => handleDeleteScene(scene.id, scene.name)}>Удалить</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Основной интерфейс редактора
  return (
    <div className={styles.editorContainer}>
      {/* Верхняя панель */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button onClick={() => setCurrentScene(null)}>← К списку</button>
          <span className={styles.sceneName}>{currentScene.name}</span>
          <button
            className={styles.saveButton}
            onClick={handleSaveScene}
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button onClick={handleUndo} title="Ctrl+Z">↩️ Отменить</button>
          <button onClick={handleRedo} title="Ctrl+Y">↪️ Повторить</button>
        </div>

        <div className={styles.toolbarCenter}>
          <div className={styles.gizmoControls}>
            <button
              className={`${styles.gizmoButton} ${gizmoMode === 'translate' ? styles.active : ''}`}
              onClick={() => setGizmoMode('translate')}
              title="G"
            >
              ↔️
            </button>
            <button
              className={`${styles.gizmoButton} ${gizmoMode === 'rotate' ? styles.active : ''}`}
              onClick={() => setGizmoMode('rotate')}
              title="R"
            >
              🔄
            </button>
            <button
              className={`${styles.gizmoButton} ${gizmoMode === 'scale' ? styles.active : ''}`}
              onClick={() => setGizmoMode('scale')}
              title="S"
            >
              📐
            </button>
          </div>

          <div className={styles.snapControls}>
            <button
              className={`${styles.snapButton} ${snapEnabled ? styles.active : ''}`}
              onClick={() => setSnapEnabled(!snapEnabled)}
            >
              🧲
            </button>
            {snapEnabled && (
              <input
                type="number"
                value={snapValue}
                onChange={(e) => setSnapValue(parseFloat(e.target.value) || 0.25)}
                step={0.1}
                min={0.1}
              />
            )}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'editor' ? styles.active : ''}`}
            onClick={() => setViewMode('editor')}
          >
            Редактор
          </button>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'preview' ? styles.active : ''}`}
            onClick={() => setViewMode('preview')}
          >
            Превью
          </button>
          <button onClick={handleEditInVR} className={styles.vrButton}>
            🥽 Войти в VR
          </button>
        </div>
      </div>

      {/* Основная область */}
      <div className={styles.mainArea}>
        {/* Левая панель - иерархия */}
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <h3>Иерархия</h3>
            <div className={styles.addButtons}>
              <button
                onClick={() => handleAddObject('model')}
                title="Добавить модель"
                disabled={models.length === 0}
              >
                🌳
              </button>
              <button
                onClick={() => handleAddObject('folder')}
                title="Добавить папку"
              >
                📁
              </button>
              <button
                onClick={() => handleAddObject('primitive', 'cube')}
                title="Добавить примитив"
              >
                📦
              </button>
              <button
                onClick={() => handleAddObject('light', 'point')}
                title="Добавить свет"
              >
                💡
              </button>
            </div>
          </div>

          <div
            className={styles.hierarchy}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDropObject(event)}
          >
            {currentScene.rootObjects.length === 0 ? (
              <div className={styles.folderHierarchy}>
                <p>Сцена пуста</p>
                <p>Добавьте объекты через кнопки выше</p>
              </div>
            ) : (
              renderHierarchy(currentScene.rootObjects)
            )}
          </div>
        </div>

        {/* Центральная область - 3D вьюпорт */}
        <div className={styles.viewport}>
          <SceneViewport
            sceneManager={sceneManager}
            selectedObjectId={selectedObjectId}
            onObjectSelect={setSelectedObjectId}
            gizmoMode={gizmoMode}
            snapEnabled={snapEnabled}
            snapValue={snapValue}
            viewMode={viewMode}
            viewPreset={viewPreset}
          />

          <div className={styles.viewportOverlay}>
            <div className={styles.viewportInfo}>
              <span>Объектов: {Object.keys(currentScene.objects).length}</span>
              <span>Версия: {currentScene.metadata.version}</span>
            </div>

            <div className={styles.viewportControls}>
              <button title="Вид спереди" onClick={() => setViewPreset('front')}>⬆️</button>
              <button title="Вид сбоку" onClick={() => setViewPreset('side')}>⬅️</button>
              <button title="Вид сверху" onClick={() => setViewPreset('top')}>🔽</button>
              <button title="Показать все объекты" onClick={() => setViewPreset('frame')}>🎯</button>
            </div>
          </div>
        </div>

        {/* Правая панель - инспектор */}
        <div className={styles.rightPanel}>
          {renderInspector()}
        </div>
      </div>

      {error && (
        <div className={styles.errorToast}>
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}