// components/vr/VRAddObjectPreview.tsx
'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox, Sphere, Cylinder, Plane, Torus, Cone } from '@react-three/drei';
import { PrimitiveType, LightType } from '@/core/scene/types';
import { GroupControllerTracked } from "@/components/vr/group-controller-tracked";

interface VRAddObjectPreviewProps {
  type: 'primitive' | 'light' | 'model' | 'effect';
  subType: string | null;
  controller: any; // Контроллер, за которым следует превью
  snapEnabled?: boolean;
  snapValue?: number;
  onPosition?: (position: THREE.Vector3, rotation: THREE.Euler) => void;
}

export function VRAddObjectPreview(
  {
    type,
    subType,
    controller,
    snapEnabled = false,
    snapValue = 0.25,
    onPosition,
  }: VRAddObjectPreviewProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isValidPosition, setIsValidPosition] = useState(true);

  // Параметры объекта по умолчанию
  const defaultParams = useMemo(() => {
    if (type === 'primitive') {
      switch (subType as PrimitiveType) {
        case 'cube':
          return { width: 1, height: 1, depth: 1 };
        case 'sphere':
          return { radius: 0.5, widthSegments: 32, heightSegments: 16 };
        case 'cylinder':
          return { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32 };
        case 'plane':
          return { width: 1, height: 1 };
        case 'torus':
          return { radius: 0.5, tubeRadius: 0.1, radialSegments: 16, tubularSegments: 32 };
        case 'cone':
          return { radius: 0.5, height: 1, radialSegments: 32 };
        default:
          return {};
      }
    }
    return {};
  }, [type, subType]);

  // Цвет превью
  const previewColor = isValidPosition ? '#4ade80' : '#ef4444';
  const previewOpacity = 0.6;

  // Применяем snapping к позиции
  useFrame(() => {
    if (!groupRef.current || !controller) return;

    const position = controller.position.clone();

    if (snapEnabled) {
      position.x = Math.round(position.x / snapValue) * snapValue;
      position.y = Math.round(position.y / snapValue) * snapValue;
      position.z = Math.round(position.z / snapValue) * snapValue;
    }

    // Проверяем валидность позиции (например, не пересекается ли с другими объектами)
    // Здесь можно добавить более сложную логику

    groupRef.current.position.copy(position);

    // Поворачиваем превью в зависимости от контроллера
    if (controller.rotation) {
      groupRef.current.rotation.copy(controller.rotation);
    }

    // Уведомляем о позиции
    if (onPosition) {
      onPosition(position, groupRef.current.rotation);
    }
  });

  // Рендер превью в зависимости от типа
  const renderPreview = () => {
    if (type === 'primitive') {
      return renderPrimitivePreview();
    } else if (type === 'light') {
      return renderLightPreview();
    } else {
      return renderDefaultPreview();
    }
  };

  const renderPrimitivePreview = () => {
    const params = defaultParams as any;
    const commonProps = {
      castShadow: true,
      receiveShadow: true,
    };

    switch (subType as PrimitiveType) {
      case 'cube':
        return (
          <RoundedBox
            args={[params.width, params.height, params.depth]}
            radius={0.02}
            {...commonProps}
          >
            <meshStandardMaterial
              color={previewColor}
              transparent
              opacity={previewOpacity}
              wireframe={!isValidPosition}
            />
          </RoundedBox>
        );

      case 'sphere':
        return (
          <Sphere
            args={[params.radius, params.widthSegments, params.heightSegments]}
            {...commonProps}
          >
            <meshStandardMaterial
              color={previewColor}
              transparent
              opacity={previewOpacity}
              wireframe={!isValidPosition}
            />
          </Sphere>
        );

      case 'cylinder':
        return (
          <Cylinder
            args={[
              params.radiusTop,
              params.radiusBottom,
              params.height,
              params.radialSegments,
            ]}
            {...commonProps}
          >
            <meshStandardMaterial
              color={previewColor}
              transparent
              opacity={previewOpacity}
              wireframe={!isValidPosition}
            />
          </Cylinder>
        );

      case 'plane':
        return (
          <Plane
            args={[params.width, params.height]}
            {...commonProps}
          >
            <meshStandardMaterial
              color={previewColor}
              transparent
              opacity={previewOpacity}
              wireframe={!isValidPosition}
              side={THREE.DoubleSide}
            />
          </Plane>
        );

      case 'torus':
        return (
          <Torus
            args={[
              params.radius,
              params.tubeRadius,
              params.radialSegments,
              params.tubularSegments,
            ]}
            {...commonProps}
          >
            <meshStandardMaterial
              color={previewColor}
              transparent
              opacity={previewOpacity}
              wireframe={!isValidPosition}
            />
          </Torus>
        );

      case 'cone':
        return (
          <Cone
            args={[params.radius, params.height, params.radialSegments]}
            {...commonProps}
          >
            <meshStandardMaterial
              color={previewColor}
              transparent
              opacity={previewOpacity}
              wireframe={!isValidPosition}
            />
          </Cone>
        );

      default:
        return renderDefaultPreview();
    }
  };

  const renderLightPreview = () => {
    const lightColor = '#fbbf24';

    return (
      <group>
        {/* Иконка света */}
        <Sphere args={[0.15, 16, 16]}>
          <meshStandardMaterial
            color={lightColor}
            emissive={lightColor}
            emissiveIntensity={0.5}
            transparent
            opacity={previewOpacity}
          />
        </Sphere>

        {/* Луч света (для направленного или spot) */}
        {(subType === 'directional' || subType === 'spot') && (
          <Cone args={[0.2, 0.5, 8]} position={[0, 0, -0.35]} rotation={[0, 0, 0]}>
            <meshStandardMaterial
              color={lightColor}
              transparent
              opacity={0.3}
            />
          </Cone>
        )}

        {/* Сфера освещения (для point) */}
        {subType === 'point' && (
          <Sphere args={[0.3, 16, 16]}>
            <meshStandardMaterial
              color={lightColor}
              transparent
              opacity={0.15}
              wireframe
            />
          </Sphere>
        )}
      </group>
    );
  };

  const renderDefaultPreview = () => {
    return (
      <RoundedBox args={[0.5, 0.5, 0.5]} radius={0.05}>
        <meshStandardMaterial
          color={previewColor}
          transparent
          opacity={previewOpacity}
          wireframe
        />
      </RoundedBox>
    );
  };

  // Если нет контроллера, не показываем превью
  if (!controller) return null;

  return (
    <GroupControllerTracked
      controller="right"
      offset={[0, 0, -0.5]} // Объект появляется перед контроллером
      smoothFactor={0.1}
    >
      <group ref={groupRef}>
        {renderPreview()}

        {/* Вспомогательные элементы */}
        {/* Оси для ориентации */}
        <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 0.3, '#ff0000']} />
        <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 0.3, '#00ff00']} />
        <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 0.3, '#0000ff']} />

        {/* Тень на полу */}
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.5, 32]} />
          <meshStandardMaterial
            color="#000000"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </GroupControllerTracked>
  );
}
