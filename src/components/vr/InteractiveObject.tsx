// components/vr/InteractiveObject.tsx
'use client';

import {useRef, useState, useCallback, useEffect} from 'react';
import * as THREE from 'three';
import {useInteractive} from "@/core/vr/xr-tracking/hooks/useInteractive";

interface InteractiveObjectProps {
  children: React.ReactNode;
  objectId: string;
  onSelect?: (id: string) => void;
  onHover?: (id: string, isHovered: boolean) => void;
  onMove?: (id: string, position: THREE.Vector3, rotation: THREE.Euler) => void;
  selectable?: boolean;
  movable?: boolean;
}

export function InteractiveObject({
                                    children,
                                    objectId,
                                    onSelect,
                                    onHover,
                                    onMove,
                                    selectable = true,
                                    movable = false,
                                  }: InteractiveObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

  // Получаем первый mesh в детях для интерактивности
  useEffect(() => {
    if (!groupRef.current) return;

    let mesh: THREE.Mesh | null = null;
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && !mesh) {
        meshRef.current = child;
      }
    });

    return;
  }, [groupRef, children]);

  console.log("INTERACTIVE UPDATED", children, objectId);
  // Регистрируем интерактивность
  useInteractive({
    meshRef,
    enabled: selectable,
    onHover: (hovering) => {
      setIsHovered(hovering);
      onHover?.(objectId, hovering);
    },
    onClick: () => {
      if (selectable) {
        setIsSelected(!isSelected);
        onSelect?.(objectId);
      }
    },
  });

  // Визуальная обратная связь
  return (
    <group ref={groupRef}>
      {children}
    </group>
  );
}
