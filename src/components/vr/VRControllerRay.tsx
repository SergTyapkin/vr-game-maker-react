'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface VRControllerRayProps {
  controller: any;
  color?: string;
  length?: number;
}

export function VRControllerRay({
  controller,
  color = '#ffffff',
  length = 10,
}: VRControllerRayProps) {
  const lineRef = useRef<any>(null);

  // Храним текущие точки в состоянии или ref
  const pointsRef = useRef<[THREE.Vector3, THREE.Vector3]>([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -length),
  ]);

  useFrame(() => {
    if (!controller) return;

    // Обновляем точки луча
    const startPoint = controller.position.clone();
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(controller.quaternion)
      .normalize();
    const endPoint = startPoint.clone().add(direction.multiplyScalar(length));

    pointsRef.current = [startPoint, endPoint];
  });

  if (!controller) return null;

  // Преобразуем точки в массив для Line компонента
  const points = [pointsRef.current[0].toArray(), pointsRef.current[1].toArray()];

  return (
    <Line
      points={points}
      color={color}
      opacity={0.5}
      transparent
      lineWidth={2}
    />
  );
}