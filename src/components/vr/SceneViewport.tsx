// components/editor/SceneViewport.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  GizmoHelper,
  GizmoViewport,
  TransformControls,
  Grid,
  PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';
import { SceneManager } from '@/core/scene/SceneManager';
import { AnySceneObject } from '@/core/scene/types';

interface SceneViewportProps {
  sceneManager: SceneManager;
  selectedObjectId: string | null;
  onObjectSelect: (id: string | null) => void;
  gizmoMode: 'translate' | 'rotate' | 'scale';
  snapEnabled: boolean;
  snapValue: number;
  viewMode: 'editor' | 'preview';
}

function SceneContent({
                        sceneManager,
                        selectedObjectId,
                        onObjectSelect,
                        gizmoMode,
                        snapEnabled,
                        snapValue,
                        viewMode,
                      }: SceneViewportProps) {
  const { scene, camera } = useThree();
  const controlsRef = useRef<any>(null);
  const transformControlsRef = useRef<any>(null);
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null);

  // Инициализация сцены
  useEffect(() => {
    sceneManager.initThreeScene(scene);

    // Добавляем базовое освещение если его нет
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;

    scene.add(ambientLight);
    scene.add(directionalLight);

    setThreeScene(scene);

    // Обработчик клика по объектам
    const handleClick = (event: any) => {
      if (viewMode === 'preview') return;

      event.stopPropagation();
      const intersects = event.intersections;

      if (intersects.length > 0) {
        let hit = intersects[0].object;

        // Ищем родителя с sceneId
        while (hit && !hit.userData.sceneId) {
          hit = hit.parent as THREE.Object3D;
        }

        if (hit && hit.userData.sceneId) {
          onObjectSelect(hit.userData.sceneId);
        }
      } else {
        onObjectSelect(null);
      }
    };

    scene.userData.onClick = handleClick;

    return () => {
      // Очистка
    };
  }, [scene, sceneManager, viewMode, onObjectSelect]);

  // Обновление TransformControls
  useEffect(() => {
    if (!transformControlsRef.current || !selectedObjectId) return;

    const threeObject = sceneManager.getThreeObjectById(selectedObjectId);
    if (threeObject) {
      transformControlsRef.current.attach(threeObject);
    }
  }, [selectedObjectId, sceneManager]);

  // Синхронизация трансформации при изменении через gizmo
  const handleTransformChange = useCallback(() => {
    if (!transformControlsRef.current || !selectedObjectId) return;

    const object = transformControlsRef.current.object;
    if (!object) return;

    sceneManager.transformObject(selectedObjectId, {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    });
  }, [selectedObjectId, sceneManager]);

  // Анимационный цикл
  useFrame((state, delta) => {
    // Обновление анимаций моделей
    scene.traverse((obj) => {
      if (obj.userData.mixer) {
        obj.userData.mixer.update(delta);
      }
    });
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 5, 10]} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={viewMode === 'editor'}
        enableZoom={true}
        enableRotate={true}
        enabled={!selectedObjectId || viewMode === 'preview'}
      />

      {selectedObjectId && viewMode === 'editor' && (
        <TransformControls
          ref={transformControlsRef}
          mode={gizmoMode}
          translationSnap={snapEnabled && gizmoMode === 'translate' ? snapValue : null}
          rotationSnap={snapEnabled && gizmoMode === 'rotate' ? snapValue * Math.PI / 180 : null}
          scaleSnap={snapEnabled && gizmoMode === 'scale' ? snapValue : null}
          onObjectChange={handleTransformChange}
          space="world"
        />
      )}

      <Grid
        position={[0, 0, 0]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
      />

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
      </GizmoHelper>

      {/* Отображение осей */}
      <axesHelper args={[5]} />

      {/* Подсветка выбранного объекта */}
      {selectedObjectId && viewMode === 'editor' && (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial wireframe color="#00ff00" />
        </mesh>
      )}
    </>
  );
}

export default function SceneViewport(props: SceneViewportProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [5, 5, 10], fov: 50 }}
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      }}
      style={{ background: '#1a1a2e' }}
      onClick={(e) => {
        // Обработка клика для выбора объектов
        const scene = e.scene as any;
        if (scene.userData.onClick) {
          scene.userData.onClick(e);
        }
      }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
