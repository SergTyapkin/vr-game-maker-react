// components/vr/VRScene.tsx
'use client';

import { VRButton } from "three-stdlib";
import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useEffect } from 'react';
import { Environment } from './Environment';
import { VRUI } from './VRUI';
import styles from './VRScene.module.css';
import {OrbitControls} from "@react-three/drei";
import {ResizeHandler} from "@/components/three-js/resize-handler";
import {XRManager} from "@/core/vr/xr-tracking/managers/XRManager";
import {XRInteractionManager} from "@/core/vr/xr-interation-manager/xr-interaction-manager";
import {XRControllersModels} from "@/components/vr/xr-controllers-models";

export default function VRScene() {
  const [isClient, setIsClient] = useState(false);

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
        onCreated={({camera, gl}) => {
          gl.xr.enabled = true;

          camera.lookAt(0, 0, 0); // Камера смотрит в начало координат

          const buttonEl = VRButton.createButton(gl);
          document.body.appendChild(buttonEl); // Создаем кнопку перехода в VR
          // buttonEl.dispatchEvent(new MouseEvent('click', {
          //   bubbles: false,
          //   cancelable: false,
          //   view: window,
          // })); // click on button
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
          target={[0, 0, 0]} // Точка, вокруг которой вращается камера
          minDistance={2}
          maxDistance={100}
          maxPolarAngle={Math.PI / 2} // Ограничение угла поворота в небо
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

          {/* Компонент для изменения размеров canvas при изменении окна или элемента */}
          <ResizeHandler/>

          {/* Менеджер получения информации о сцене и контроллерах */}
          <XRManager/>

          {/* Менеджер интерактивности взаимодействия с объектами */}
          <XRInteractionManager/>

          {/* Отрисовка моделей контроллеров */}
          <XRControllersModels/>

          {/* Базовое окружение */}
          <Environment />

          {/* VR Меню - показываем только когда в VR */}
          <VRUI />
        </Suspense>
      </Canvas>
    </>
  );
}
