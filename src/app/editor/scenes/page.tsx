// app/editor/scenes/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SceneManager } from '@/core/scene/SceneManager';
import { useScenes} from "@/api/scenes/useScenes";
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
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapValue, setSnapValue] = useState(0.25);
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());

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

    sceneManager.on('scene:loaded', handleSceneLoaded);
    sceneManager.on('scene:created', handleSceneCreated);
    sceneManager.on('scene:saved', handleSceneSaved);
    sceneManager.on('object:added', handleObjectAdded);
    sceneManager.on('object:removed', handleObjectRemoved);
    sceneManager.on('object:updated', handleObjectUpdated);
    sceneManager.on('object:selected', handleObjectSelected);
    sceneManager.on('scene:error', handleSceneError);

    return () => {
      sceneManager.off('scene:loaded', handleSceneLoaded);
      sceneManager.off('scene:created', handleSceneCreated);
      sceneManager.off('scene:saved', handleSceneSaved);
      sceneManager.off('object:added', handleObjectAdded);
      sceneManager.off('object:removed', handleObjectRemoved);
      sceneManager.off('object:updated', handleObjectUpdated);
      sceneManager.off('object:selected', handleObjectSelected);
      sceneManager.off('scene:error', handleSceneError);
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
  const handleAddObject = (type: 'primitive' | 'light' | 'empty', subType?: string) => {
    if (!currentScene) return;

    let newObject: Partial<AnySceneObject> = {
      name: `New_${type}_${Date.now()}`,
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
      newObject = {
        ...newObject,
        type: 'light',
        lightType: (subType as LightType) || 'point',
        params: {
          color: '#ffffff',
          intensity: 1,
          castShadow: false,
        },
      };
    } else {
      newObject = {
        ...newObject,
        type: 'empty',
      };
    }

    const objectId = sceneManager.addObject(newObject, selectedObjectId || undefined);
    setSelectedObjectId(objectId);

    const updatedScene = sceneManager.getCurrentScene();
    if (updatedScene) {
      setCurrentScene({ ...updatedScene });
    }

    if (selectedObjectId) {
      setExpandedObjects(prev => {
        const next = new Set(prev);
        next.add(selectedObjectId);
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

    const duplicated = JSON.parse(JSON.stringify(object));
    duplicated.name = `${object.name}_copy`;
    duplicated.transform.position[0] += 1;

    const newId = sceneManager.addObject(duplicated, object.parentId);
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

  // Блокировка объекта
  const handleToggleLock = (objectId: string) => {
    const object = currentScene?.objects[objectId];
    if (object) {
      sceneManager.updateObject(objectId, { locked: !object.locked });

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
              onClick={(e) => e.stopPropagation()}
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
                className={styles.lockButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLock(objectId);
                }}
                title={object.locked ? 'Разблокировать' : 'Заблокировать'}
              >
                {object.locked ? '🔒' : '🔓'}
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
        <div className={styles.inspectorEmpty}>
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
              <input
                type="number"
                value={object.transform.position[0]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  position: [parseFloat(e.target.value) || 0, object.transform.position[1], object.transform.position[2]]
                })}
                step={snapEnabled ? snapValue : 0.1}
              />
              <input
                type="number"
                value={object.transform.position[1]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  position: [object.transform.position[0], parseFloat(e.target.value) || 0, object.transform.position[2]]
                })}
                step={snapEnabled ? snapValue : 0.1}
              />
              <input
                type="number"
                value={object.transform.position[2]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  position: [object.transform.position[0], object.transform.position[1], parseFloat(e.target.value) || 0]
                })}
                step={snapEnabled ? snapValue : 0.1}
              />
            </div>
          </div>

          <div className={styles.transformRow}>
            <label>Rotation</label>
            <div className={styles.vectorInput}>
              <input
                type="number"
                value={object.transform.rotation[0]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  rotation: [parseFloat(e.target.value) || 0, object.transform.rotation[1], object.transform.rotation[2]]
                })}
                step={snapEnabled ? snapValue * 15 : 1}
              />
              <input
                type="number"
                value={object.transform.rotation[1]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  rotation: [object.transform.rotation[0], parseFloat(e.target.value) || 0, object.transform.rotation[2]]
                })}
                step={snapEnabled ? snapValue * 15 : 1}
              />
              <input
                type="number"
                value={object.transform.rotation[2]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  rotation: [object.transform.rotation[0], object.transform.rotation[1], parseFloat(e.target.value) || 0]
                })}
                step={snapEnabled ? snapValue * 15 : 1}
              />
            </div>
          </div>

          <div className={styles.transformRow}>
            <label>Scale</label>
            <div className={styles.vectorInput}>
              <input
                type="number"
                value={object.transform.scale[0]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  scale: [parseFloat(e.target.value) || 1, object.transform.scale[1], object.transform.scale[2]]
                })}
                step={0.1}
                min={0.01}
              />
              <input
                type="number"
                value={object.transform.scale[1]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  scale: [object.transform.scale[0], parseFloat(e.target.value) || 1, object.transform.scale[2]]
                })}
                step={0.1}
                min={0.01}
              />
              <input
                type="number"
                value={object.transform.scale[2]}
                onChange={(e) => handleTransformChange(selectedObjectId, {
                  scale: [object.transform.scale[0], object.transform.scale[1], parseFloat(e.target.value) || 1]
                })}
                step={0.1}
                min={0.01}
              />
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
          </div>
        )}

        {object.type === 'light' && (
          <div className={styles.inspectorSection}>
            <h4>Light</h4>

            <div className={styles.propertyRow}>
              <label>Type</label>
              <select
                value={(object as any).lightType}
                onChange={(e) => handlePropertyChange(selectedObjectId, { lightType: e.target.value as LightType | undefined })}
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
          </div>
        )}

        <div className={styles.inspectorSection}>
          <h4>Components</h4>

          <button
            className={styles.addComponentButton}
            onClick={() => {
              // TODO: Открыть диалог добавления компонента
              console.log('Add component to', selectedObjectId);
            }}
          >
            + Add Component
          </button>

          {object.components && object.components.length > 0 ? (
            object.components.map(component => (
              <div key={component.id} className={styles.componentItem}>
                <span>{component.scriptName}</span>
                <button
                  className={styles.removeComponentButton}
                  onClick={() => {
                    // TODO: Удалить компонент
                    console.log('Remove component', component.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <p className={styles.noComponents}>Нет компонентов</p>
          )}
        </div>
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
            <div className={styles.empty}>
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
          <button onClick={handleUndo}>↩️ Отменить</button>
        </div>

        <div className={styles.toolbarCenter}>
          <div className={styles.gizmoControls}>
            <button
              className={`${styles.gizmoButton} ${gizmoMode === 'translate' ? styles.active : ''}`}
              onClick={() => setGizmoMode('translate')}
            >
              ↔️
            </button>
            <button
              className={`${styles.gizmoButton} ${gizmoMode === 'rotate' ? styles.active : ''}`}
              onClick={() => setGizmoMode('rotate')}
            >
              🔄
            </button>
            <button
              className={`${styles.gizmoButton} ${gizmoMode === 'scale' ? styles.active : ''}`}
              onClick={() => setGizmoMode('scale')}
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
                onClick={() => handleAddObject('empty')}
                title="Добавить Empty"
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

          <div className={styles.hierarchy}>
            {currentScene.rootObjects.length === 0 ? (
              <div className={styles.emptyHierarchy}>
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
          />

          <div className={styles.viewportOverlay}>
            <div className={styles.viewportInfo}>
              <span>Объектов: {Object.keys(currentScene.objects).length}</span>
              <span>Версия: {currentScene.metadata.version}</span>
            </div>

            <div className={styles.viewportControls}>
              <button title="Вид спереди">⬆️</button>
              <button title="Вид сбоку">⬅️</button>
              <button title="Вид сверху">🔽</button>
              <button title="Сбросить камеру">🎯</button>
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
