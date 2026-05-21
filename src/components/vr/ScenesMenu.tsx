// components/vr/ScenesMenu.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MenuButton, VRMenu } from './VRMenu';
import { useRouter } from 'next/navigation';

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
}

interface ScenesMenuProps {
  onBack: () => void;
  onSelectScene: (sceneId: string, isCreated?: boolean) => void;
  onEditScene: (sceneId: string) => void;
  currentSceneId?: string | null;
}

export function ScenesMenu({ onBack, onSelectScene, onEditScene, currentSceneId }: ScenesMenuProps) {
  const router = useRouter();
  const [scenes, setScenes] = useState<SceneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScenes();
  }, []);

  const loadScenes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scenes');
      const data = await response.json();

      if (response.ok) {
        setScenes(data.scenes || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load scenes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScene = useCallback(async () => {
    let resultSceneName = '';
    const trimmedName = newSceneName.trim();
    if (!trimmedName) {
      resultSceneName = `scene-${String(Math.random()).slice(2, 8)}`;
      console.warn('No scene name provided. Generated scene name:', resultSceneName)
    } else {
      resultSceneName = trimmedName;
    }

    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: resultSceneName }),
      });

      const data = await response.json();

      if (response.ok) {
        setScenes(prev => [...prev, data.scene]);
        setIsCreating(false);
        setNewSceneName('');
        onSelectScene(data.scene.id, true);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create scene');
    }
  }, [newSceneName, onSelectScene]);

  const handleDeleteScene = useCallback(async (sceneId: string, sceneName: string) => {
    // В VR сложно показывать confirm, поэтому просто удаляем
    try {
      const response = await fetch(`/api/scenes/${sceneId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setScenes(prev => prev.filter(s => s.id !== sceneId));
      }
    } catch (err) {
      setError('Failed to delete scene');
    }
  }, []);

  const handleEditInBrowser = useCallback((sceneId: string) => {
    // Выходим из VR и переходим в браузерный редактор
    router.push(`/editor/scenes?open=${sceneId}`);
  }, [router]);

  // Формируем кнопки меню
  const getMenuButtons = () => {
    // if (isCreating) {
    //   return [
    //     {
    //       id: 'create-confirm',
    //       label: 'Create',
    //       variant: 'primary' as const,
    //       onClick: handleCreateScene,
    //       disabled: !newSceneName.trim(),
    //     },
    //     {
    //       id: 'create-cancel',
    //       label: 'Cancel',
    //       variant: 'secondary' as const,
    //       onClick: () => {
    //         setIsCreating(false);
    //         setNewSceneName('');
    //       },
    //     },
    //   ];
    // }

    const buttons: MenuButton[] = [
      {
        id: 'back',
        label: '<- Back',
        variant: 'secondary' as const,
        onClick: onBack,
      },
      {
        id: 'create',
        label: '+ Create new scene',
        variant: 'primary' as const,
        // onClick: () => setIsCreating(true),
        onClick: handleCreateScene,
      },
    ];

    if (loading) {
      buttons.push({
        id: 'loading',
        label: 'Loading...',
        variant: 'secondary' as const,
        onClick: () => {},
        disabled: true,
      });
    } else {
      // Добавляем существующие сцены
      scenes.forEach(scene => {
        const isCurrent = scene.id === currentSceneId;

        buttons.push({
          id: `scene-${scene.id}`,
          label: `${scene.name} ${isCurrent ? '<-' : ''}`,
          variant: isCurrent ? 'primary' as const : 'secondary' as const,
          onClick: () => onSelectScene(scene.id),
        });

        // Добавляем кнопки действий для сцены
        // buttons.push({
        //   id: `edit-${scene.id}`,
        //   label: 'Edit in browser',
        //   variant: 'secondary' as const,
        //   onClick: () => handleEditInBrowser(scene.id),
        // });

        buttons.push({
          id: `edit-${scene.id}`,
          label: '| Edit',
          variant: 'secondary' as const,
          onClick: () => onEditScene(scene.id),
        });

        if (!isCurrent) {
          buttons.push({
            id: `delete-${scene.id}`,
            label: '| Delete',
            variant: 'danger' as const,
            onClick: () => handleDeleteScene(scene.id, scene.name),
          });
        }
      });
    }

    return buttons;
  };

  const title = isCreating ? 'New scene' : 'Scenes';

  return (
    <group>
      <VRMenu
        title={title}
        buttons={getMenuButtons()}
        attachToHead={true}
        distance={2}
      />

      {/*{isCreating && (*/}
      {/*  // Здесь можно добавить 3D поле ввода для названия сцены*/}
      {/*  // Пока используем простое текстовое поле через HTML*/}
      {/*  <HtmlInput*/}
      {/*    value={newSceneName}*/}
      {/*    onChange={setNewSceneName}*/}
      {/*    placeholder="Название сцены"*/}
      {/*    onSubmit={handleCreateScene}*/}
      {/*    onCancel={() => {*/}
      {/*      setIsCreating(false);*/}
      {/*      setNewSceneName('');*/}
      {/*    }}*/}
      {/*  />*/}
      {/*)}*/}
    </group>
  );
}

// Компонент для HTML ввода в VR (опционально)
function HtmlInput({ value, onChange, placeholder, onSubmit, onCancel }: any) {
  // Можно реализовать ввод через HTML overlay
  return null;
}
