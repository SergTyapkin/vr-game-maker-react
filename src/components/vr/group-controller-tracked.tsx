import {useFrame, useThree} from "@react-three/fiber";
import React, {useRef} from "react";
import {Euler, Group, Quaternion, Vector3} from "three";
import {useXRControllers} from "@/core/vr/xr-tracking/hooks/useXRControllers";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";



type Props = {
  children: React.ReactNode;
  /** Какой контроллер использовать: 'left' | 'right' | 'both' (для центра) */
  controller: 'left' | 'right' | 'both';
  /** Смещение относительно контроллера */
  offset?: [number, number, number];
  /** Использовать gripSpace (рукоятка) или targetRaySpace (луч) */
  useRaySpace?: boolean;
  /** Блокировка по осям позиции */
  lockX?: boolean;
  lockY?: boolean;
  lockZ?: boolean;
  lockPosition?: boolean;
  /** Блокировка по осям поворота */
  lockAngleX?: boolean;
  lockAngleY?: boolean;
  lockAngleZ?: boolean;
  lockAngles?: boolean;
  /** Отключить в определенных режимах */
  enableDesktop?: boolean;
  disableXR?: boolean;
  /** Коэффициент сглаживания движения (0-1) */
  smoothFactor?: number;
  [key: string]: any;
};

export function GroupControllerTracked(
  {
    children,
    controller,
    offset = [0, 0, 0],
    useRaySpace = false,
    lockX = false,
    lockY = false,
    lockZ = false,
    lockPosition = false,
    lockAngleX = false,
    lockAngleY = false,
    lockAngleZ = false,
    lockAngles = false,
    enableDesktop = false,
    disableXR = false,
    smoothFactor = 0,
    ...props
  }: Props) {
  const {camera} = useThree();
  const {isPresenting} = useXR();
  const {left, right} = useXRControllers();
  const groupRef = useRef<Group>(null!);

  // Переиспользуемые объекты для оптимизации
  const tempPosition = useRef(new Vector3());
  const tempQuaternion = useRef(new Quaternion());
  const tempEuler = useRef(new Euler());

  useFrame(() => {
    if (!groupRef.current) return;

    // Определяем целевые позицию и поворот
    let targetPosition = new Vector3();
    let targetQuaternion = new Quaternion();

    if (!isPresenting) {
      // Desktop режим - эмуляция контроллера (опционально)
      if (!enableDesktop) return;

      // В десктоп режиме можно просто привязать к камере
      const direction = new Vector3();
      camera.getWorldDirection(direction);

      // Говорим, что контроллер на расстоянии 0.5м от камеры
      targetPosition.copy(camera.position).add(direction.multiplyScalar(0.5));
      targetQuaternion.copy(camera.quaternion);

      // Добавляем смещение в локальном пространстве
      if (offset.some(v => v !== 0)) {
        const offsetDir = new Vector3(...offset);
        offsetDir.applyQuaternion(targetQuaternion);
        targetPosition.add(offsetDir);
      }
    } else {
      // VR режим
      if (disableXR) return;

      // Получаем состояние нужного контроллера
      const controllerState = controller === 'left' ? left :
        controller === 'right' ? right : null;

      if (!controllerState) return;

      // Выбираем нужное пространство
      if (!useRaySpace) {
        targetPosition.copy(controllerState.gripPosition);
        targetQuaternion.copy(controllerState.gripQuaternion);
      } else {
        targetPosition.copy(controllerState.targetRayPosition);
        targetQuaternion.copy(controllerState.targetRayQuaternion);
      }

      // Если нужно получить центр между контроллерами
      if (controller === 'both' && left && right) {
        targetPosition.copy(left.gripPosition)
          .add(right.gripPosition)
          .multiplyScalar(0.5);

        // Для поворота берем средний (можно использовать левый или правый)
        targetQuaternion.copy(left.gripQuaternion);
      }

      // Применяем смещение в локальном пространстве контроллера
      if (offset.some(v => v !== 0)) {
        const offsetDir = new Vector3(...offset);
        offsetDir.applyQuaternion(targetQuaternion);
        targetPosition.add(offsetDir);
      }
    }

    // Сохраняем текущие позицию и поворот
    const currentPos = groupRef.current.position;
    const currentRot = groupRef.current.rotation;

    // Копируем целевые значения в переиспользуемые объекты
    tempPosition.current.copy(targetPosition);
    tempQuaternion.current.copy(targetQuaternion);

    // Применяем блокировку позиции
    if (lockX || lockPosition) tempPosition.current.x = currentPos.x;
    if (lockY || lockPosition) tempPosition.current.y = currentPos.y;
    if (lockZ || lockPosition) tempPosition.current.z = currentPos.z;

    // Применяем блокировку углов
    if (lockAngleX || lockAngleY || lockAngleZ || lockAngles) {
      tempEuler.current.setFromQuaternion(tempQuaternion.current);

      if (lockAngleX || lockAngles) tempEuler.current.x = currentRot.x;
      if (lockAngleY || lockAngles) tempEuler.current.y = currentRot.y;
      if (lockAngleZ || lockAngles) tempEuler.current.z = currentRot.z;

      tempQuaternion.current.setFromEuler(tempEuler.current);
    }

    // Применяем с плавной интерполяцией если нужно
    if (smoothFactor > 0) {
      groupRef.current.position.lerp(tempPosition.current, smoothFactor);
      groupRef.current.quaternion.slerp(tempQuaternion.current, smoothFactor);
    } else {
      groupRef.current.position.copy(tempPosition.current);
      groupRef.current.quaternion.copy(tempQuaternion.current);
    }
  });

  return <group ref={groupRef} {...props}>{children}</group>;
}
