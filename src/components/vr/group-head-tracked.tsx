import {useFrame, useThree} from "@react-three/fiber";
import React, {useRef} from "react";
import {Euler, Group, Quaternion, Vector3} from "three";
import {useXRHead} from "@/core/vr/xr-tracking/hooks/useXRHead";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";


type Props = {
  children: React.ReactNode;
  distance: number;
  lockX?: boolean;
  lockY?: boolean;
  lockZ?: boolean;
  lockPosition?: boolean;
  lockAngleX?: boolean;
  lockAngleY?: boolean;
  lockAngleZ?: boolean;
  lockAngles?: boolean;
  disableDesktop?: boolean;
  disableXR?: boolean;
  smoothFactor?: number;
  [key: string]: any;
};

export function GroupHeadTracked(
  {
    children,
    distance,
    lockX = false,
    lockY = false,
    lockZ = false,
    lockPosition = false,
    lockAngleX = false,
    lockAngleY = false,
    lockAngleZ = false,
    lockAngles = false,
    disableDesktop = false,
    disableXR = false,
    smoothFactor = 0,
    ...props
  }: Props) {
  const {camera} = useThree();
  const {isPresenting} = useXR();
  const {position: headPosition, quaternion: headQuaternion} = useXRHead();
  const groupRef = useRef<Group>(null!);

  // Переиспользуемые объекты (создаются один раз)
  const targetPosition = useRef(new Vector3());
  const targetQuaternion = useRef(new Quaternion());
  const direction = useRef(new Vector3());
  const tempEuler = useRef(new Euler());
  const currentPos = useRef(new Vector3());
  const currentRot = useRef(new Euler());

  useFrame(() => {
    if (!groupRef.current) return;

    // Сохраняем текущие позицию и поворот для блокировок
    currentPos.current.copy(groupRef.current.position);
    currentRot.current.copy(groupRef.current.rotation);

    if (!isPresenting) {
      // Desktop режим
      if (disableDesktop) return;

      // Получаем направление камеры
      camera.getWorldDirection(direction.current);

      // Вычисляем целевую позицию
      targetPosition.current
        .copy(camera.position)
        .add(direction.current.multiplyScalar(distance));

      // Копируем поворот камеры
      targetQuaternion.current.copy(camera.quaternion);
    } else {
      // VR режим
      if (disableXR) return;
      if (!headQuaternion || !headPosition) return;

      // Направление вперед (ось -Z) и смещение
      direction.current.set(0, 0, -1);
      direction.current.applyQuaternion(headQuaternion);

      targetPosition.current
        .copy(headPosition)
        .add(direction.current.multiplyScalar(distance));
      targetQuaternion.current.copy(headQuaternion);
    }

    // Применяем блокировку позиции
    if (lockX || lockY || lockZ || lockPosition) {
      if (lockX || lockPosition) targetPosition.current.x = currentPos.current.x;
      if (lockY || lockPosition) targetPosition.current.y = currentPos.current.y;
      if (lockZ || lockPosition) targetPosition.current.z = currentPos.current.z;
    }

    // Применяем блокировку углов
    tempEuler.current.setFromQuaternion(targetQuaternion.current);
    if (lockAngleX || lockAngleY || lockAngleZ || lockAngles) {
      if (lockAngleX || lockAngles) tempEuler.current.x = currentRot.current.x;
      if (lockAngleY || lockAngles) tempEuler.current.y = currentRot.current.y;
      if (lockAngleZ || lockAngles) tempEuler.current.z = currentRot.current.z;
    }

    // Применяем углы
    targetQuaternion.current.setFromEuler(tempEuler.current);

    // Применяем позицию с плавной интерполяцией
    if (smoothFactor > 0) {
      groupRef.current.position.lerp(targetPosition.current, smoothFactor);
      groupRef.current.quaternion.slerp(targetQuaternion.current, smoothFactor);
    } else {
      groupRef.current.position.copy(targetPosition.current);
      groupRef.current.quaternion.copy(targetQuaternion.current);
    }
  });

  return <group ref={groupRef} {...props}>{children}</group>;
}
