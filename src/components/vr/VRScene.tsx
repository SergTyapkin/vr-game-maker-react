// components/vr/VRScene.tsx
'use client';

import { VRButton } from "three-stdlib";
import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useEffect } from 'react';
import { Environment } from './Environment';
import { VRUI } from './VRUI';
import styles from './VRScene.module.css';
import { OrbitControls } from "@react-three/drei";
import { ResizeHandler } from "@/components/three-js/resize-handler";
import { XRManager } from "@/core/vr/xr-tracking/managers/XRManager";
import { XRInteractionManager } from "@/core/vr/xr-interation-manager/xr-interaction-manager";
import { XRControllersModels } from "@/components/vr/xr-controllers-models";
import { useSearchParams } from 'next/navigation';

interface VRSceneProps {
  mode?: 'editor' | 'game';
  sceneId?: string;
}

export default function VRScene({ mode, sceneId }: VRSceneProps) {
  const [isClient, setIsClient] = useState(false);
  const searchParams = useSearchParams();

  // Приоритет: props > searchParams
  const effectiveMode = mode || (searchParams.get('mode') as 'editor' | 'game') || undefined;
  const effectiveSceneId = sceneId || searchParams.get('sceneId') || undefined;

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div className={styles.fallback}>Loading VR...</div>;
  }

  return (
    <>
      <Canvas
        className={styles.canvas}
        onCreated={({ camera, gl }) => {
          gl.xr.enabled = true;
          camera.lookAt(0, 0, 0);

          // Создаем кнопку VR
          const existingButton = document.getElementById('VRButton');
          if (!existingButton) {
            const buttonEl = VRButton.createButton(gl);
            buttonEl.id = 'VRButton';
            document.body.appendChild(buttonEl);
          }
        }}
        camera={{ position: [0, 1.6, 3], fov: 75 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          target={[0, 0, 0]}
          minDistance={2}
          maxDistance={100}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={0}
        />

        <Suspense fallback={null}>
          {/* Освещение */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />

          {/* Компонент для изменения размеров canvas */}
          <ResizeHandler />

          {/* Менеджер получения информации о сцене и контроллерах */}
          <XRManager />

          {/* Менеджер интерактивности взаимодействия с объектами */}
          <XRInteractionManager />

          {/* Отрисовка моделей контроллеров */}
          <XRControllersModels />

          {/* Базовое окружение */}
          <Environment />

          {/* VR UI с поддержкой редактора и игры */}
          <VRUI initialMode={effectiveMode} initialSceneId={effectiveSceneId} />
        </Suspense>
      </Canvas>
    </>
  );
}
