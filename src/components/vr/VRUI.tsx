// components/vr/VRUI.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VRMenu } from './VRMenu';
import { ScenesMenu } from './ScenesMenu';
import { VREditorScene } from './VREditorScene';
import { GameMode } from './GameMode';
import { useXR } from "@/core/vr/xr-tracking/hooks/useXR";
import { SceneManager } from '@/core/scene/SceneManager';
import {VREditorManager} from "@/core/vr/vrEditorManager";

type View = 'main' | 'scenes' | 'editor' | 'game';

interface VRUIProps {
  initialMode?: 'editor' | 'game';
  initialSceneId?: string;
}

export function VRUI({ initialMode, initialSceneId }: VRUIProps) {
  const { session } = useXR();
  const lastSessionRef = useRef<XRSession>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const sceneManager = useRef(SceneManager.getInstance()).current;
  const editorManager = useRef(VREditorManager.getInstance()).current;

  // Определяем начальный режим
  const getInitialView = (): View => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'editor') return 'editor';
    if (urlMode === 'game') return 'game';
    if (initialMode === 'editor') return 'editor';
    if (initialMode === 'game') return 'game';
    return 'main';
  };

  const [currentView, setCurrentView] = useState<View>(getInitialView());
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    searchParams.get('sceneId') || initialSceneId || null
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    lastSessionRef.current = session ?? lastSessionRef.current;
  }, [session]);

  const handleEnterGame = useCallback(async () => {
    if (!selectedSceneId) {
      console.warn('No scene selected for game mode');
      return;
    }

    setIsLoading(true);

    try {
      // Загружаем сцену если ещё не загружена
      if (sceneManager.getCurrentScene()?.id !== selectedSceneId) {
        await sceneManager.loadScene(selectedSceneId);
      }

      setCurrentView('game');
      console.log('Entering game mode with scene:', selectedSceneId);
    } catch (error) {
      console.error('Failed to enter game:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSceneId, sceneManager]);

  const handleOpenScenes = useCallback(() => {
    setCurrentView('scenes');
  }, []);

  const handleBackToMain = useCallback(() => {
    setCurrentView('main');
  }, []);

  const handleExitEditor = useCallback(() => {
    editorManager.closeMenu();
    setCurrentView('main');
  }, [editorManager]);

  const handleExitGame = useCallback(() => {
    setCurrentView('main');
  }, []);

  const handleExitVR = useCallback(async () => {
    // Очищаем состояние редактора
    editorManager.closeMenu();

    // Отключаемся от сцены
    sceneManager.disconnect();

    // Завершаем VR сессию
    await lastSessionRef.current?.end?.();
    lastSessionRef.current = null;

    // Удаляем кнопку VR
    document.getElementById('VRButton')?.remove?.();

    // Возвращаемся на главную
    router.push('/');
  }, [router, sceneManager, editorManager]);

  const handleSelectScene = useCallback((sceneId: string, isCreated?: boolean) => {
    setSelectedSceneId(sceneId);
    // После выбора сцены возвращаемся в главное меню
    if (!isCreated) {
      setCurrentView('main');
    }
  }, []);

  const handleEditScene = useCallback((sceneId: string) => {
    setSelectedSceneId(sceneId);
    // После выбора сцены возвращаемся в главное меню
    setCurrentView('editor');
  }, []);

  // Показываем загрузку
  if (isLoading) {
    return (
      <VRMenu
        title="Loading..."
        buttons={[]}
        attachToHead={true}
        distance={2}
      />
    );
  }

  // Режим редактора
  if (currentView === 'editor') {
    return (
      <VREditorScene
        initialSceneId={selectedSceneId!}
        onExit={handleExitEditor}
      />
    );
  }

  // Режим игры
  if (currentView === 'game') {
    return (
      <GameMode
        sceneId={selectedSceneId!}
        onExit={handleExitGame}
      />
    );
  }

  // Меню сцен
  if (currentView === 'scenes') {
    return (
      <ScenesMenu
        onBack={handleBackToMain}
        onSelectScene={handleSelectScene}
        onEditScene={handleEditScene}
        currentSceneId={selectedSceneId}
      />
    );
  }

  // Главное меню
  return (
    <VRMenu
      title="VR Game Studio"
      buttons={[
        {
          id: 'enter-game',
          label: 'Run the game',
          variant: 'primary',
          onClick: handleEnterGame,
        },
        {
          id: 'scenes',
          label: 'Scenes',
          variant: 'secondary',
          onClick: handleOpenScenes,
        },
        {
          id: 'exit',
          label: 'Exit VR',
          variant: 'danger',
          onClick: handleExitVR,
        },
      ]}
      attachToHead={true}
      distance={2}
    />
  );
}
