// components/vr/VRTransformGizmo.tsx
'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { SceneManager } from '@/core/scene/SceneManager';

interface VRTransformGizmoProps {
  objectId: string;
  mode: 'translate' | 'rotate' | 'scale';
  snapEnabled: boolean;
  snapValue: number;
  onTransform: (transform: any) => void;
}

export function VRTransformGizmo({
                                   objectId,
                                   mode,
                                   snapEnabled,
                                   snapValue,
                                   onTransform,
                                 }: VRTransformGizmoProps) {
  const transformControlsRef = useRef<any>(null);
  const sceneManager = useRef(SceneManager.getInstance()).current;

  useEffect(() => {
    const threeObject = sceneManager.getThreeObjectById(objectId);

    if (threeObject && transformControlsRef.current) {
      transformControlsRef.current.attach(threeObject);
    }

    return () => {
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
      }
    };
  }, [objectId, sceneManager]);

  const handleTransformChange = () => {
    const object = transformControlsRef.current?.object;
    if (!object) return;

    onTransform({
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    });
  };

  return (
    <TransformControls
      ref={transformControlsRef}
      mode={mode}
      translationSnap={snapEnabled && mode === 'translate' ? snapValue : null}
      rotationSnap={snapEnabled && mode === 'rotate' ? snapValue * 15 * Math.PI / 180 : null}
      scaleSnap={snapEnabled && mode === 'scale' ? snapValue : null}
      onObjectChange={handleTransformChange}
      space="world"
      size={0.5}
    />
  );
}
