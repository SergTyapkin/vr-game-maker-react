import {useFrame, useThree} from "@react-three/fiber";
import React, {useRef} from "react";
import {Group, Vector3, Quaternion} from "three";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";


type Props = {
  children: React.ReactNode;
  mode?: 'vertical' | 'horizontal' | 'spherical' | 'none';
  disableDesktop?: boolean;
  disableXR?: boolean;
  smoothFactor?: number;
  [key: string]: any;
};

export function GroupFacedInCamera(
  {
    children,
    mode = 'vertical',
    disableDesktop = false,
    disableXR = false,
    smoothFactor = 0,
    ...props
  }: Props) {
  const {camera, gl} = useThree();
  const {isPresenting, referenceSpace} = useXR();
  const groupRef = useRef<Group>(null!);

  const targetPos = useRef(new Vector3());
  const dir = useRef(new Vector3());
  const targetQuat = useRef(new Quaternion());

  useFrame(() => {
    if (!groupRef.current) return;

    // Позиция камеры
    if (!isPresenting) {
      if (disableDesktop) return;
      targetPos.current.copy(camera.position);
    } else {
      if (disableXR) return;

      const frame = gl.xr.getFrame();
      if (!referenceSpace || !frame) return;

      const viewerPose = frame.getViewerPose(referenceSpace);
      if (!viewerPose || viewerPose.views.length < 2) return;

      const leftView = viewerPose.views[0];
      const rightView = viewerPose.views[1];

      targetPos.current.set(
        (leftView.transform.position.x + rightView.transform.position.x) / 2,
        (leftView.transform.position.y + rightView.transform.position.y) / 2,
        (leftView.transform.position.z + rightView.transform.position.z) / 2
      );
    }

    const worldPos = groupRef.current.getWorldPosition(new Vector3());
    dir.current.copy(targetPos.current).sub(worldPos).normalize();

    switch (mode) {
      case 'vertical':
        // Вертикальный билборд (поворот только по Y)
        targetQuat.current.setFromUnitVectors(
          new Vector3(0, 0, 1),
          new Vector3(dir.current.x, 0, dir.current.z).normalize()
        );
        break;

      case 'horizontal':
        // Горизонтальный билборд (поворот только по Y)
        targetQuat.current.setFromUnitVectors(
          new Vector3(0, 1, 0),
          new Vector3(dir.current.x, 0, dir.current.z).normalize()
        );
        break;

      case 'spherical':
        // Сферический билборд (всегда лицом к камере)
        targetQuat.current.setFromUnitVectors(
          new Vector3(0, 0, 1),
          dir.current
        );
        break;

      case 'none':
      default:
        return;
    }

    // Плавная интерполяция
    if (smoothFactor > 0) {
      groupRef.current.quaternion.slerp(targetQuat.current, smoothFactor);
    } else {
      groupRef.current.quaternion.copy(targetQuat.current);
    }
  });

  return <group ref={groupRef} {...props}>{children}</group>;
}
