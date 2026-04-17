'use client';

import {RefObject, useEffect, useRef} from 'react';
import * as THREE from 'three';
import {XrInteractionManager} from "@/core/vr/xr-interation-manager/xrInteractionManager";

export interface InteractiveObject {
  meshRef:  RefObject<THREE.Mesh>;
  onHover?: (isHovering: boolean, uv?: THREE.Vector2, point?: THREE.Vector3) => void;
  onClick?: (uv: THREE.Vector2, point: THREE.Vector3) => void;
  enabled: boolean;
}

interface UseInteractiveOptions {
  meshRef:  RefObject<THREE.Mesh | null>;
  onClick?: (uv: THREE.Vector2, point: THREE.Vector3) => void;
  onHover?: (isHovering: boolean, uv?: THREE.Vector2, point?: THREE.Vector3) => void;
  enabled?: boolean;
}

export function useInteractive(
  {
    meshRef,
    onClick,
    onHover,
    enabled = true,
  }: UseInteractiveOptions
) {
  const idRef = useRef(`interactive-${Math.random().toString(36).substr(2, 9)}`);
  const isRegisteredRef = useRef(false);

  // Регистрация когда mesh появился
  useEffect(() => {
    if (!enabled || !meshRef.current) return;
    if (isRegisteredRef.current) return;

    const obj: InteractiveObject = {
      meshRef: meshRef as RefObject<THREE.Mesh>,
      onClick,
      onHover,
      enabled,
    };

    isRegisteredRef.current = true;
    const unregisterCallback = XrInteractionManager.register(idRef.current, obj);
    return () => {
      unregisterCallback();
      isRegisteredRef.current = false;
    }
  }, [meshRef.current, onClick, onHover, enabled]);
}
