// components/vr/Environment.tsx
'use client';

import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InteractiveObject } from './InteractiveObject';

export function Environment() {
  const gridRef = useRef<THREE.GridHelper>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Скайбокс с градиентом
  const skyboxTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height * 0.7;
      const size = Math.random() * 2 + 1;
      const alpha = Math.random() * 0.8 + 0.2;
      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }, []);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += 0.001;
    }
  });

  const handleObjectSelect = (id: string) => {
    setSelectedObjectId(id === selectedObjectId ? null : id);
    console.log('Selected object:', id);
  };

  return (
    <group>
      {/* Скайбокс */}
      <mesh>
        <sphereGeometry args={[500, 60, 40]} />
        <meshStandardMaterial
          map={skyboxTexture}
          side={THREE.BackSide}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      <fog attach="fog" args={['#16213e', 30, 100]} />

      {/* Пол */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <circleGeometry args={[20, 64]} />
        <meshStandardMaterial
          color="#1a1a2e"
          roughness={0.4}
          metalness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      <gridHelper
        ref={gridRef}
        args={[40, 40, '#9333ea', '#4a4a6a']}
        position={[0, 0, 0]}
      />

      {/* Интерактивные декоративные объекты */}
      <InteractiveObject
        objectId="ring-purple"
        onSelect={handleObjectSelect}
        selectable={true}
      >
        <mesh ref={ringRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.8, 3, 64]} />
          <meshStandardMaterial
            color={selectedObjectId === 'ring-purple' ? "#e4d2f4" : "#9333ea"}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </InteractiveObject>

      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.8, 5, 64]} />
        <meshStandardMaterial
          color="#db2777"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Интерактивный центральный маркер */}
      <InteractiveObject
        objectId="center-marker"
        onSelect={handleObjectSelect}
        selectable={true}
      >
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={selectedObjectId === 'center-marker' ? "#e4d2f4" : "#9333ea"}
            emissiveIntensity={0.5}
          />
        </mesh>
      </InteractiveObject>

      {/* Тестовые интерактивные кубы */}
      <InteractiveObject
        objectId="cube-red"
        onSelect={handleObjectSelect}
        selectable={true}
      >
        <mesh position={[-2, 0.5, -1]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color={selectedObjectId === 'cube-red' ? "#efb1b1" : "#ef4444"}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
      </InteractiveObject>

      <InteractiveObject
        objectId="cube-blue"
        onSelect={handleObjectSelect}
        selectable={true}
      >
        <mesh position={[2, 0.5, -1]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color={selectedObjectId === 'cube-blue' ? "#9fbff4" : "#3b82f6"}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
      </InteractiveObject>

      <InteractiveObject
        objectId="sphere-green"
        onSelect={handleObjectSelect}
        selectable={true}
      >
        <mesh position={[0, 0.5, 2]} castShadow receiveShadow>
          <sphereGeometry args={[0.3, 32, 16]} />
          <meshStandardMaterial
            color={selectedObjectId === 'sphere-green' ? "#a9ddcc" : "#10b981"}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
      </InteractiveObject>
    </group>
  );
}
