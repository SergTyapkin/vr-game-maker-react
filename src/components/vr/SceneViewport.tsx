// components/editor/SceneViewport.tsx (альтернативная версия)
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
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

interface SceneViewportProps {
  sceneManager: SceneManager;
  selectedObjectId: string | null;
  onObjectSelect: (id: string | null) => void;
  gizmoMode: 'translate' | 'rotate' | 'scale';
  snapEnabled: boolean;
  snapValue: number;
  viewMode: 'editor' | 'preview';
}

function SceneContent(props: SceneViewportProps) {
  const {
    sceneManager,
    selectedObjectId,
    onObjectSelect,
    gizmoMode,
    snapEnabled,
    snapValue,
    viewMode,
  } = props;

  const { scene, camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const transformControlsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // Инициализация сцены
  useEffect(() => {
    if (!ready) {
      sceneManager.initThreeScene(scene);

      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 10, 7);
      directionalLight.castShadow = true;

      scene.add(ambientLight);
      scene.add(directionalLight);

      setReady(true);
    }
  }, [scene, sceneManager, ready]);

  // Обновление TransformControls
  useEffect(() => {
    if (!transformControlsRef.current || !selectedObjectId || viewMode === 'preview') return;

    const threeObject = sceneManager.getThreeObjectById(selectedObjectId);
    if (threeObject) {
      transformControlsRef.current.attach(threeObject);
    }
  }, [selectedObjectId, sceneManager, viewMode]);

  // Обработчик клика с использованием Raycaster
  const handleCanvasClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (viewMode === 'preview') return;

    // Получаем координаты мыши
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    // Собираем все объекты с sceneId
    const objects: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.userData.sceneId) {
        objects.push(obj);
      }
    });

    const intersects = raycaster.current.intersectObjects(objects, true);

    if (intersects.length > 0) {
      // Находим первый объект с sceneId
      for (const intersect of intersects) {
        let target = intersect.object;
        while (target && !target.userData.sceneId) {
          target = target.parent as THREE.Object3D;
        }
        if (target?.userData.sceneId) {
          onObjectSelect(target.userData.sceneId);
          return;
        }
      }
    }

    // Клик мимо объектов - сбрасываем выделение
    onObjectSelect(null);
  }, [viewMode, gl, camera, scene, onObjectSelect]);

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

  useFrame((state, delta) => {
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
          rotationSnap={snapEnabled && gizmoMode === 'rotate' ? snapValue * 15 * Math.PI / 180 : null}
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

      <axesHelper args={[5]} />
    </>
  );
}

export default function SceneViewport(props: SceneViewportProps) {
  const { viewMode } = props;

  const handlePointerMissed = useCallback(() => {
    if (viewMode === 'editor') {
      props.onObjectSelect(null);
    }
  }, [viewMode, props.onObjectSelect]);

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
      onPointerMissed={handlePointerMissed}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
