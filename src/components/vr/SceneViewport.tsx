// components/editor/SceneViewport.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber';
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
  viewPreset?: 'perspective' | 'front' | 'side' | 'top' | 'frame';
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
    viewPreset,
  } = props;

  const { scene, camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const transformControlsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const isDraggingRef = useRef(false);

  // Инициализация сцены
  useEffect(() => {
    if (!ready) {
      sceneManager.initThreeScene(scene);

      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 10, 7);
      directionalLight.castShadow = true;
      
      ambientLight.userData.isDefault = true;
      directionalLight.userData.isDefault = true;

      scene.add(ambientLight);
      scene.add(directionalLight);

      setReady(true);
    }
  }, [scene, sceneManager, ready]);

  // Обновление выбранного объекта
  useEffect(() => {
    if (selectedObjectId) {
      const obj = sceneManager.getThreeObjectById(selectedObjectId);
      setSelectedObject(obj || null);
    } else {
      setSelectedObject(null);
    }
  }, [selectedObjectId, sceneManager]);

  // Прикрепляем TransformControls к выбранному объекту
  useEffect(() => {
    if (transformControlsRef.current && viewMode === 'editor') {
      if (selectedObject && selectedObject.parent !== null) {
        // Обновляем мировую матрицу для правильной позиции гизмо
        selectedObject.updateWorldMatrix(true, true);
        transformControlsRef.current.attach(selectedObject);
        transformControlsRef.current.updateMatrixWorld();
      } else {
        // Открепляем, но не скрываем (TransformControls сам скроется)
        transformControlsRef.current.detach();
      }
    }
  }, [selectedObject, viewMode, transformControlsRef]);

  // Обработка изменений из TransformControls
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

  // Обработчики перетаскивания
  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    // Отложенный сброс, чтобы клик после перетаскивания не сработал
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  }, []);

  // Обработчик клика с использованием Raycaster
  const handleCanvasClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (viewMode === 'preview') return;

    // Игнорируем клики при перетаскивании гизмо
    if (isDraggingRef.current) return;

    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    const objects: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.userData.isPickProxy) objects.push(obj);
    });

    const intersects = raycaster.current.intersectObjects(objects, false);

    if (intersects.length > 0) {
      const sceneId = intersects[0].object.userData.sceneId;
      onObjectSelect(sceneId);
      return;
    }
    onObjectSelect(null);
  }, [viewMode, gl, camera, scene, onObjectSelect]);

  // Обработка изменения предустановленного вида
  useEffect(() => {
    if (!camera || viewPreset === 'perspective') return;
    
    const distance = 10;
    const target = new THREE.Vector3(0, 0, 0);
    
    switch (viewPreset) {
      case 'front':
        camera.position.set(0, 0, distance);
        break;
      case 'side':
        camera.position.set(distance, 0, 0);
        break;
      case 'top':
        camera.position.set(0, distance, 0);
        break;
      case 'frame':
        const box = new THREE.Box3();
        scene.traverse((obj) => {
          if (obj.userData.sceneId) {
            box.expandByObject(obj);
          }
        });
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * Math.PI / 180;
          const distance = maxDim / (2 * Math.tan(fov / 2));
          camera.position.copy(center).add(new THREE.Vector3(0, 0, distance));
          target.copy(center);
        }
        break;
    }
    
    camera.lookAt(target);
    controlsRef.current?.update();
  }, [viewPreset, camera, scene]);

  useFrame(() => {
    if (transformControlsRef.current && selectedObject) {
      // Проверяем, что объект все еще в сцене
      if (selectedObject.parent === null) {
        // Объект был удален из сцены, отключаем гизмо
        transformControlsRef.current.detach();
        setSelectedObject(null);
        return;
      }
      
      transformControlsRef.current.updateMatrixWorld();
    }
  });

  return (
    <group userData={{isDefault: true}} onClick={handleCanvasClick}>
      <PerspectiveCamera makeDefault position={[5, 5, 10]} />

      <OrbitControls
        userData={{isDefault: true}}
        ref={controlsRef}
        makeDefault
        enablePan={viewMode === 'editor'}
        enableZoom={true}
        enableRotate={true}
        enabled={!selectedObjectId || viewMode === 'preview'}
      />

      {/* Гизмо всегда присутствует, но скрыт если нет выбранного объекта */}
      <TransformControls
        userData={{isDefault: true}}
        ref={transformControlsRef}
        mode={gizmoMode}
        translationSnap={snapEnabled && gizmoMode === 'translate' ? snapValue : null}
        rotationSnap={snapEnabled && gizmoMode === 'rotate' ? snapValue * 15 * Math.PI / 180 : null}
        scaleSnap={snapEnabled && gizmoMode === 'scale' ? snapValue : null}
        onObjectChange={handleTransformChange}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        space="world"
        size={0.7}
        enabled={Boolean(selectedObject) && viewMode === 'editor'}
      />

      <mesh userData={{isDefault: true}} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#252936" roughness={0.92} metalness={0} transparent opacity={0.5}/>
      </mesh>

      <Grid
        userData={{isDefault: true}}
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

      <GizmoHelper userData={{isDefault: true}} alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
      </GizmoHelper>

      <axesHelper userData={{isDefault: true}} args={[5]} />
    </group>
  );
}

export default function SceneViewport(props: SceneViewportProps) {
  const { viewMode, onObjectSelect } = props;

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
      onPointerMissed={() => {
        if (viewMode === 'editor') {
          onObjectSelect(null);
        }
      }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}