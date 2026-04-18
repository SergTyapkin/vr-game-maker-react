// app/editor/scenes/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SceneManager } from '@/core/scene/SceneManager';
import {
  AnySceneObject,
  SceneData,
  PrimitiveType,
  LightType,
  Transform
} from '@/core/scene/types';
import styles from './page.module.css';

// Динамический импорт 3D вьюпорта
const SceneViewport = dynamic(() => import('@/components/vr/SceneViewport'), {
  ssr: false,
  loading: () => <div className={styles.viewportLoading}>Загрузка 3D вьюпорта...</div>,
});

interface SceneListItem {
  id: string;
  name: string;
  description?: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    thumbnail?: string;
  };
}

export default function ScenesPage() {
  const router = useRouter();
  const sceneManager = useRef(SceneManager.getInstance()).current;

  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [currentScene, setCurrentScene] = useState<SceneData | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapValue, setSnapValue] = useState(1);
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());

  // Загрузка списка сцен
  const loadScenes = useCallback(async () => {
    try {
      const response = await fetch('/api/scenes');
      const data = await response.json();

      if (response.ok) {
        setScenes(data.scenes);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load scenes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenes();

    // Подписываемся на события SceneManager
    sceneManager.on('scene:loaded', (scene: SceneData) => {
      setCurrentScene(scene);
      setSelectedObjectId(null);
    });

    sceneManager.on('scene:created', (scene: SceneData) => {
      setCurrentScene(scene);
      loadScenes();
    });

    sceneManager.on('scene:saved', (scene: SceneData) => {
      setSaving(false);
      loadScenes();
    });

    sceneManager.on('object:selected', (objectId: string) => {
      setSelectedObjectId(objectId);
    });

    sceneManager.on('scene:error', (error: Error) => {
      setError(error.message);
    });

    return () => {
      sceneManager.removeAllListeners();
    };
  }, [sceneManager, loadScenes]);

  // Создание новой сцены
  const handleCreateScene = () => {
    if (!newSceneName.trim()) return;

    const scene = sceneManager.createScene(newSceneName);
    setCurrentScene(scene);
    setShowCreateDialog(false);
    setNewSceneName('');
  };

  // Загрузка сцены
  const handleLoadScene = async (sceneId: string) => {
    setLoading(true);
    const scene = await sceneManager.loadScene(sceneId);
    if (scene) {
      setCurrentScene(scene);
    }
    setLoading(false);
  };

  // Сохранение сцены
  const handleSaveScene = async () => {
    setSaving(true);
    await sceneManager.saveScene();
    setSaving(false);
  };

  // Удаление сцены
  const handleDeleteScene = async (sceneId: string, sceneName: string) => {
    if (!confirm(`Удалить сцену "${sceneName}"?`)) return;

    try {
      const response = await fetch(`/api/scenes/${sceneId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadScenes();
        if (currentScene?.id === sceneId) {
          setCurrentScene(null);
        }
      }
    } catch (err) {
      setError('Failed to delete scene');
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
  };

  // Удаление объекта
  const handleDeleteObject = (objectId: string) => {
    sceneManager.removeObject(objectId);
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null);
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
  };

  // Обновление трансформации
  const handleTransformChange = (objectId: string, transform: Partial<Transform>) => {
    sceneManager.transformObject(objectId, transform);
  };

  // Обновление свойств объекта
  const handlePropertyChange = (objectId: string, updates: Partial<AnySceneObject>) => {
    sceneManager.updateObject(objectId, updates);
  };

  // Переключение видимости
  const handleToggleVisibility = (objectId: string) => {
    const object = currentScene?.objects[objectId];
    if (object) {
      sceneManager.updateObject(objectId, { visible: !object.visible });
    }
  };

  // Блокировка объекта
  const handleToggleLock = (objectId: string) => {
    const object = currentScene?.objects[objectId];
    if (object) {
      sceneManager.updateObject(objectId, { locked: !object.locked });
    }
  };

  // Отмена действия
  const handleUndo = () => {
    sceneManager.undo();
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

  // Рендер иерархии объектов
  const renderHierarchy = (objectIds: string[], level: number = 0) => {
    return objectIds.map(objectId => {
      const object = currentScene?.objects[objectId];
      if (!object) return null;

      const isSelected = selectedObjectId === objectId;
      const isExpanded = expandedObjects.has(objectId);
      const hasChildren = object.children.length > 0;

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
                onChange={(e) => handlePropertyChange(selectedObjectId, { primitiveType: e.target.value })}
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
          </div>
        )}

        {object.type === 'light' && (
          <div className={styles.inspectorSection}>
            <h4>Light</h4>

            <div className={styles.propertyRow}>
              <label>Type</label>
              <select
                value={(object as any).lightType}
                onChange={(e) => handlePropertyChange(selectedObjectId, { lightType: e.target.value })}
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
              // Открыть диалог добавления компонента
            }}
          >
            + Add Component
          </button>

          {object.components.map(component => (
            <div key={component.id} className={styles.componentItem}>
              <span>{component.scriptName}</span>
              <button
                className={styles.removeComponentButton}
                onClick={() => {
                  // Удалить компонент
                }}
              >
                ×
              </button>
            </div>
          ))}
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
                onChange={(e) => setSnapValue(parseFloat(e.target.value) || 1)}
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
          <button onClick={() => router.push('/vr')}>Войти в VR</button>
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
    </div>
  );
}
