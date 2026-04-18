// components/vr/VRMenu.tsx
'use client';

import {ReactNode, useMemo, useRef, useCallback, useState} from 'react';
import { Text3D, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {useInteractive} from "@/core/vr/xr-tracking/hooks/useInteractive";
import {GroupHeadTracked} from "@/components/vr/group-head-tracked";
import {GroupControllerTracked} from "@/components/vr/group-controller-tracked";
import {GroupFacedInCamera} from "@/components/vr/group-faced-in-camera";


export interface MenuButton {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface VRMenuProps {
  title?: string;
  buttons: MenuButton[];
  position?: [number, number, number];
  width?: number;
  buttonHeight?: number;
  spacing?: number;
  attachToHead?: boolean;
  attachToController?: 'left' | 'right' | null;
  distance?: number;
}

// Отдельный компонент для интерактивной кнопки
function MenuButton3D({
                        button,
                        width,
                        height,
                        position,
                      }: {
  button: MenuButton;
  width: number;
  height: number;
  position: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Цвета в зависимости от состояния
  const getButtonColor = useCallback(() => {
    if (button.disabled) return '#4a4a6a';
    if (isHovered) {
      if (button.variant === 'primary') return '#7c3aed';
      if (button.variant === 'danger') return '#f87171';
      return '#9ca3af';
    }
    if (button.variant === 'primary') return '#2563eb';
    if (button.variant === 'secondary') return '#6b7280';
    if (button.variant === 'danger') return '#ef4444';
    return '#2563eb';
  }, [button.variant, button.disabled, isHovered]);

  // Регистрируем интерактивность
  useInteractive({
    meshRef,
    enabled: !button.disabled,
    onHover: (hovering) => {
      setIsHovered(hovering);
    },
    onClick: (uv, point) => {
      if (!button.disabled) {
        button.onClick();
      }
    },
  });

  return (
    <group position={position}>
      {/* Фон кнопки */}
      <RoundedBox
        ref={meshRef}
        args={[width, height, 0.02]}
        radius={0.01}
      >
        <meshStandardMaterial
          color={getButtonColor()}
          transparent
          opacity={button.disabled ? 0.5 : 0.9}
          roughness={0.3}
          metalness={0.1}
          emissive={button.variant === 'primary' && !button.disabled ? '#9333ea' : '#000000'}
          emissiveIntensity={isHovered ? 0.4 : 0.2}
        />
      </RoundedBox>

      {/* Текст кнопки */}
      <Text3D
        font={"/fonts/font.json"}
        position={[-0.3, -0.02, 0]}
        size={0.04}
        height={0.011}
      >
        {button.label}
      </Text3D>
    </group>
  );
}

export function VRMenu({
                         title = 'Меню',
                         buttons,
                         position = [0, 0, 0],
                         width = 0.8,
                         buttonHeight = 0.12,
                         spacing = 0.02,
                         attachToHead = false,
                         attachToController = null,
                         distance = 2,
                       }: VRMenuProps) {
  const totalHeight = buttons.length * (buttonHeight + spacing) + 0.2;

  const menuContent = useMemo(() => (
    <group position={position}>
      {/* Задний фон меню */}
      <RoundedBox
        args={[width + 0.1, totalHeight + 0.1, 0.02]}
        radius={0.02}
        position={[0, totalHeight / 2 - 0.05, -0.01]}
      >
        <meshStandardMaterial
          color="#1a1a2e"
          transparent
          opacity={0.95}
          roughness={0.3}
          metalness={0.1}
        />
      </RoundedBox>

      {/* Рамка */}
      <RoundedBox
        args={[width + 0.12, totalHeight + 0.12, 0.01]}
        radius={0.025}
        position={[0, totalHeight / 2 - 0.05, -0.02]}
      >
        <meshStandardMaterial
          color="#9333ea"
          transparent
          opacity={0.5}
          roughness={0.2}
          metalness={0.3}
        />
      </RoundedBox>

      {/* Заголовок */}
      <Text3D
        font={"/fonts/font.json"}
        position={[-0.3, totalHeight - 0.12, 0.02]}
        size={0.06}
        height={0.01}
      >
        {title}
      </Text3D>

      {/* Разделитель */}
      <mesh position={[0, totalHeight - 0.14, 0.01]}>
        <boxGeometry args={[width * 0.8, 0.002, 0.01]} />
        <meshStandardMaterial color="#4a4a6a" />
      </mesh>

      {/* Интерактивные кнопки */}
      {buttons.map((button, index) => {
        const yPos = totalHeight - 0.22 - index * (buttonHeight + spacing);

        return (
          <MenuButton3D
            key={button.id}
            button={button}
            width={width * 0.9}
            height={buttonHeight}
            position={[0, yPos, 0]}
          />
        );
      })}
    </group>
  ), [buttons, title, width, buttonHeight, spacing, totalHeight, position]);

  // Если меню прикреплено к голове
  if (attachToHead) {
    return (
      <GroupHeadTracked distance={distance} smoothFactor={0.2}>
        {menuContent}
      </GroupHeadTracked>
    );
  }

  // Если меню прикреплено к контроллеру
  if (attachToController) {
    return (
      <GroupControllerTracked
        controller={attachToController}
        offset={[0, 0.05, -0.15]}
        smoothFactor={0.2}
      >
        <GroupFacedInCamera mode="spherical">
          {menuContent}
        </GroupFacedInCamera>
      </GroupControllerTracked>
    );
  }

  // Обычное меню, повернутое к камере
  return (
    <GroupFacedInCamera mode="spherical" smoothFactor={0.2}>
      {menuContent}
    </GroupFacedInCamera>
  );
}
