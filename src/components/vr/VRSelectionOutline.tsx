// components/vr/VRSelectionOutline.tsx
'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneManager } from '@/core/scene/SceneManager';

interface VRSelectionOutlineProps {
  objectId: string;
  color?: string;
  pulseSpeed?: number;
}

export function VRSelectionOutline({
                                     objectId,
                                     color = '#4ade80',
                                     pulseSpeed = 2,
                                   }: VRSelectionOutlineProps) {
  const outlineRef = useRef<THREE.Mesh>(null);
  const sceneManager = useRef(SceneManager.getInstance()).current;

  useFrame(({ clock }) => {
    if (!outlineRef.current) return;

    // Пульсация
    const pulse = Math.sin(clock.getElapsedTime() * pulseSpeed) * 0.1 + 0.9;
    outlineRef.current.scale.setScalar(pulse);
  });

  useEffect(() => {
    const targetObject = sceneManager.getThreeObjectById(objectId);

    if (targetObject && outlineRef.current) {
      // Вычисляем bounding box
      const bbox = new THREE.Box3().setFromObject(targetObject);
      const size = bbox.getSize(new THREE.Vector3());
      const center = bbox.getCenter(new THREE.Vector3());

      outlineRef.current.position.copy(center);
      outlineRef.current.scale.set(size.x, size.y, size.z);
    }
  }, [objectId, sceneManager]);

  return (
    <mesh ref={outlineRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={color}
        wireframe
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}
