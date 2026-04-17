// components/vr/VRUI.tsx
'use client';

import {useState, useCallback, useEffect, useRef} from 'react';
import { useRouter } from 'next/navigation';
import { VRMenu } from './VRMenu';
import { ScenesMenu } from './ScenesMenu';
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";

type View = 'main' | 'scenes' | 'game';

export function VRUI() {
  const {session} = useXR();
  const lastSessionRef = useRef<XRSession>(null);
  const router = useRouter();
  const [currentView, setCurrentView] = useState<View>('main');

  useEffect(() => {
    lastSessionRef.current = session ?? lastSessionRef.current;
  }, [session]);

  const handleEnterGame = useCallback(() => {
    setCurrentView('game');
    // Здесь будет запуск игровой логики
    console.log('Entering game...');
  }, []);

  const handleOpenScenes = useCallback(() => {
    setCurrentView('scenes');
  }, []);

  const handleBackToMain = useCallback(() => {
    setCurrentView('main');
  }, []);

  const handleExitVR = useCallback(async () => {
    await lastSessionRef.current?.end?.();
    lastSessionRef.current = null;
    document.getElementById('VRButton')?.remove?.();
    router.push('/');
  }, [router]);

  // Главное меню
  if (currentView === 'main') {
    return (
      <VRMenu
        title="VR Game Studio"
        buttons={[
          {
            id: 'enter-game',
            label: 'Start the game',
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

  // Меню сцен
  if (currentView === 'scenes') {
    return (
      <ScenesMenu
        onBack={handleBackToMain}
        onSelectScene={(sceneId) => {
          console.log('Selected scene:', sceneId);
          // Здесь будет загрузка сцены
        }}
      />
    );
  }

  // Режим игры - пока ничего не показываем
  return null;
}
