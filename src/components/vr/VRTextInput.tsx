// components/vr/VRTextInput.tsx
'use client';

import { useRef, useState } from 'react';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {useInteractive} from "@/core/vr/xr-tracking/hooks/useInteractive";

interface VRTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
  position?: [number, number, number];
}

// Виртуальная клавиатура для VR (упрощенная версия)
export function VRTextInput({
                              value,
                              onChange,
                              onSubmit,
                              onCancel,
                              placeholder = 'Введите текст...',
                              position = [0, 1.2, -1.5],
                            }: VRTextInputProps) {
  const keys = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
    [' ', '✓', '✗'],
  ];

  const handleKeyPress = (key: string) => {
    switch (key) {
      case '⌫':
        onChange(value.slice(0, -1));
        break;
      case '✓':
        onSubmit();
        break;
      case '✗':
        onCancel();
        break;
      case ' ':
        onChange(value + ' ');
        break;
      default:
        onChange(value + key);
    }
  };

  return (
    <group position={position}>
      {/* Фон */}
      <RoundedBox args={[0.8, 0.6, 0.02]} radius={0.02} position={[0, 0, -0.01]}>
        <meshStandardMaterial color="#1a1a2e" transparent opacity={0.95} />
      </RoundedBox>

      {/* Поле ввода */}
      <RoundedBox args={[0.7, 0.08, 0.01]} radius={0.01} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#2a2a4e" />
      </RoundedBox>

      <Text
        position={[0, 0.2, 0.01]}
        fontSize={0.04}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {value || placeholder}
      </Text>

      {/* Клавиатура */}
      <group position={[0, -0.05, 0]}>
        {keys.map((row, rowIndex) => (
          <group key={rowIndex} position={[0, -rowIndex * 0.07, 0]}>
            {row.map((key, keyIndex) => {
              const keyWidth = key === ' ' ? 0.2 : 0.055;
              const spacing = 0.06;
              const totalWidth = row.length * spacing;
              const x = (keyIndex - (row.length - 1) / 2) * spacing;

              return (
                <VRKey
                  key={keyIndex}
                  position={[x, 0, 0]}
                  width={keyWidth}
                  label={key}
                  onPress={() => handleKeyPress(key)}
                />
              );
            })}
          </group>
        ))}
      </group>
    </group>
  );
}

function VRKey({ position, width, label, onPress }: {
  position: [number, number, number];
  width: number;
  label: string;
  onPress: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  useInteractive({
    meshRef,
    enabled: true,
    onHover: (hovering) => setIsHovered(hovering),
    onClick: onPress,
  });

  return (
    <group position={position}>
      <RoundedBox
        ref={meshRef}
        args={[width, 0.05, 0.01]}
        radius={0.005}
      >
        <meshStandardMaterial
          color={isHovered ? '#7c3aed' : '#3a3a5e'}
          emissive={isHovered ? '#9333ea' : '#000000'}
          emissiveIntensity={0.3}
        />
      </RoundedBox>

      <Text
        position={[0, 0, 0.006]}
        fontSize={0.025}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}
