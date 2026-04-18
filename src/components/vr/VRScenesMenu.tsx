// components/vr/VRScenesMenu.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { VRMenu } from './VRMenu';
import * as THREE from 'three';


interface SceneData {
  id: string;
  name: string;
  description?: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    thumbnail?: string;
  };
  objects?: Record<string, any>;
  rootObjects?: string[];
}

interface VRScenesMenuProps {
  onBack: () => void;
  onSelectScene: (sceneId: string) => void;
  onCreateScene?: (name: string) => void;
  onDeleteScene?: (sceneId: string) => void;
  onDuplicateScene?: (sceneId: string) => void;
  currentSceneId?: string | null;
}

type MenuState = 'list' | 'create' | 'confirm-delete';

export function VRScenesMenu({
                               onBack,
                               onSelectScene,
                               onCreateScene,
                               onDeleteScene,
                               onDuplicateScene,
                               currentSceneId,
                             }: VRScenesMenuProps) {
  const [scenes, setScenes] = useState<SceneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState>('list');
  const [newSceneName, setNewSceneName] = useState('');
  const [sceneToDelete, setSceneToDelete] = useState<SceneData | null>(null);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [page, setPage] = useState(0);
  const itemsPerPage = 5;

  const inputRef = useRef<THREE.Mesh>(null);

  // Загрузка списка сцен
  useEffect(() => {
    loadScenes();
  }, []);

  const loadScenes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/scenes');
      const data = await response.json();

      if (response.ok) {
        // Сортируем по дате обновления (сначала новые)
        const sortedScenes = (data.scenes || []).sort((a: SceneData, b: SceneData) => {
          return new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime();
        });
        setScenes(sortedScenes);
      } else {
        setError(data.error || 'Failed to load scenes');
      }
    } catch (err) {
      setError('Network error');
      console.error('Failed to load scenes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScene = useCallback(async () => {
    if (!newSceneName.trim()) return;

    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSceneName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setScenes(prev => [data.scene, ...prev]);
        setMenuState('list');
        setNewSceneName('');

        if (onCreateScene) {
          onCreateScene(data.scene.name);
        }

        // Автоматически выбираем новую сцену
        onSelectScene(data.scene.id);
      } else {
        setError(data.error || 'Failed to create scene');
      }
    } catch (err) {
      setError('Network error');
      console.error('Failed to create scene:', err);
    }
  }, [newSceneName, onCreateScene, onSelectScene]);

  const handleDeleteScene = useCallback(async () => {
    if (!sceneToDelete) return;

    try {
      const response = await fetch(`/api/scenes/${sceneToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setScenes(prev => prev.filter(s => s.id !== sceneToDelete.id));
        setMenuState('list');

        if (onDeleteScene) {
          onDeleteScene(sceneToDelete.id);
        }

        setSceneToDelete(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete scene');
      }
    } catch (err) {
      setError('Network error');
      console.error('Failed to delete scene:', err);
    }
  }, [sceneToDelete, onDeleteScene]);

  const handleDuplicateScene = useCallback(async (scene: SceneData) => {
    try {
      // Загружаем полные данные сцены
      const response = await fetch(`/api/scenes/${scene.id}`);
      const data = await response.json();

      if (response.ok && data.scene) {
        // Создаем копию с новым именем
        const duplicatedScene = {
          ...data.scene,
          name: `${scene.name} (копия)`,
        };

        delete duplicatedScene.id;
        delete duplicatedScene.metadata;

        const createResponse = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(duplicatedScene),
        });

        const createData = await createResponse.json();

        if (createResponse.ok) {
          setScenes(prev => [createData.scene, ...prev]);

          if (onDuplicateScene) {
            onDuplicateScene(createData.scene.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to duplicate scene:', err);
      setError('Failed to duplicate scene');
    }
  }, [onDuplicateScene]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;

    return date.toLocaleDateString('ru-RU');
  };

  const getObjectCount = (scene: SceneData): number => {
    return scene.objects ? Object.keys(scene.objects).length : (scene.rootObjects?.length || 0);
  };

  // Формируем кнопки для разных состояний меню
  const getMenuButtons = () => {
    // Состояние подтверждения удаления
    if (menuState === 'confirm-delete' && sceneToDelete) {
      return [
        {
          id: 'confirm-delete',
          label: `Удалить "${sceneToDelete.name}"?`,
          variant: 'danger' as const,
          onClick: handleDeleteScene,
        },
        {
          id: 'cancel-delete',
          label: 'Отмена',
          variant: 'secondary' as const,
          onClick: () => {
            setMenuState('list');
            setSceneToDelete(null);
          },
        },
      ];
    }

    // Состояние создания новой сцены
    if (menuState === 'create') {
      return [
        {
          id: 'create-title',
          label: 'Создание новой сцены',
          variant: 'secondary' as const,
          onClick: () => {},
          disabled: true,
        },
        {
          id: 'create-input-label',
          label: `Название: ${newSceneName || '...'}`,
          variant: 'secondary' as const,
          onClick: () => {
            // В VR можно использовать голосовой ввод или виртуальную клавиатуру
            // Пока просто запрашиваем через prompt
            const name = prompt('Введите название сцены:');
            if (name) {
              setNewSceneName(name);
            }
          },
        },
        {
          id: 'create-confirm',
          label: '✓ Создать',
          variant: 'primary' as const,
          onClick: handleCreateScene,
          disabled: !newSceneName.trim(),
        },
        {
          id: 'create-cancel',
          label: '← Назад',
          variant: 'secondary' as const,
          onClick: () => {
            setMenuState('list');
            setNewSceneName('');
          },
        },
      ];
    }

    // Основное меню со списком сцен
    const buttons: any[] = [
      {
        id: 'header-back',
        label: '← Назад',
        variant: 'secondary' as const,
        onClick: onBack,
      },
      {
        id: 'header-create',
        label: '+ Новая сцена',
        variant: 'primary' as const,
        onClick: () => setMenuState('create'),
      },
      {
        id: 'header-refresh',
        label: '↻ Обновить',
        variant: 'secondary' as const,
        onClick: loadScenes,
      },
    ];

    if (loading) {
      buttons.push({
        id: 'loading',
        label: 'Загрузка...',
        variant: 'secondary' as const,
        onClick: () => {},
        disabled: true,
      });
      return buttons;
    }

    if (error) {
      buttons.push({
        id: 'error',
        label: `❌ ${error}`,
        variant: 'danger' as const,
        onClick: loadScenes,
      });
      return buttons;
    }

    if (scenes.length === 0) {
      buttons.push({
        id: 'empty',
        label: 'Нет сцен. Создайте новую!',
        variant: 'secondary' as const,
        onClick: () => setMenuState('create'),
      });
      return buttons;
    }

    // Пагинация
    const totalPages = Math.ceil(scenes.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, scenes.length);
    const currentScenes = scenes.slice(startIndex, endIndex);

    // Добавляем сцены
    currentScenes.forEach((scene) => {
      const isCurrent = scene.id === currentSceneId;
      const objectCount = getObjectCount(scene);

      // Основная кнопка выбора сцены
      buttons.push({
        id: `scene-${scene.id}`,
        label: `${isCurrent ? '✓ ' : ''}${scene.name}`,
        variant: isCurrent ? 'primary' as const : 'secondary' as const,
        onClick: () => onSelectScene(scene.id),
      });

      // Информация о сцене
      buttons.push({
        id: `info-${scene.id}`,
        label: `  📦 ${objectCount} объектов | ${formatDate(scene.metadata.updatedAt)}`,
        variant: 'secondary' as const,
        onClick: () => {},
        disabled: true,
      });

      // Действия со сценой
      buttons.push({
        id: `actions-${scene.id}`,
        label: '  ✏️ Выбрать  📋 Копия  🗑️ Удалить',
        variant: 'secondary' as const,
        onClick: () => {}, // Заглушка, реальные действия ниже
      });

      // Отдельные кнопки действий
      buttons.push({
        id: `select-${scene.id}`,
        label: '  → Выбрать',
        variant: 'secondary' as const,
        onClick: () => onSelectScene(scene.id),
      });

      buttons.push({
        id: `duplicate-${scene.id}`,
        label: '  📋 Дублировать',
        variant: 'secondary' as const,
        onClick: () => handleDuplicateScene(scene),
      });

      if (!isCurrent) {
        buttons.push({
          id: `delete-${scene.id}`,
          label: '  🗑️ Удалить',
          variant: 'danger' as const,
          onClick: () => {
            setSceneToDelete(scene);
            setMenuState('confirm-delete');
          },
        });
      }
    });

    // Навигация по страницам
    if (totalPages > 1) {
      const navButtons = [];

      if (page > 0) {
        navButtons.push({
          id: 'page-prev',
          label: '←',
          variant: 'secondary' as const,
          onClick: () => setPage(p => p - 1),
        });
      }

      navButtons.push({
        id: 'page-info',
        label: `${page + 1} / ${totalPages}`,
        variant: 'secondary' as const,
        onClick: () => {},
        disabled: true,
      });

      if (page < totalPages - 1) {
        navButtons.push({
          id: 'page-next',
          label: '→',
          variant: 'secondary' as const,
          onClick: () => setPage(p => p + 1),
        });
      }

      // Добавляем навигацию в одну строку
      if (navButtons.length > 0) {
        buttons.push({
          id: 'pagination',
          label: navButtons.map(b => b.label).join(' '),
          variant: 'secondary' as const,
          onClick: () => {},
          disabled: true,
        });

        // Добавляем функциональные кнопки навигации
        navButtons.forEach(btn => {
          if (!btn.disabled) {
            buttons.push(btn);
          }
        });
      }
    }

    return buttons;
  };

  const getMenuTitle = () => {
    switch (menuState) {
      case 'create':
        return 'Новая сцена';
      case 'confirm-delete':
        return 'Подтверждение';
      default:
        return `Сцены (${scenes.length})`;
    }
  };

  return (
    <VRMenu
      title={getMenuTitle()}
      buttons={getMenuButtons()}
      attachToHead={true}
      distance={2}
      width={1.0}
      buttonHeight={0.1}
      spacing={0.015}
    />
  );
}
