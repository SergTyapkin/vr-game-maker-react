// components/vr/VRControllerRay.tsx
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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
  const lineRef = useRef<THREE.Line>(null);

  useFrame(() => {
    if (!lineRef.current || !controller) return;

    const points = [
      controller.position.clone(),
      controller.position.clone().add(
        new THREE.Vector3(0, 0, -1)
          .applyQuaternion(controller.quaternion)
          .multiplyScalar(length)
      ),
    ];

    lineRef.current.geometry.setFromPoints(points);
  });

  if (!controller) return null;

  return (
    <line ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial color={color} opacity={0.5} transparent />
    </line>
  );
}
