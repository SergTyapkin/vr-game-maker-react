'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { XrInteractionManager } from './xrInteractionManager';
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";
import {useXRControllers} from "@/core/vr/xr-tracking/hooks/useXRControllers";

export function XRInteractionManager() {
  const { camera, gl } = useThree();
  const { isPresenting } = useXR();
  const controllers = useXRControllers();

  const lastTriggerStateRef = useRef(false);

  // Инициализация менеджера с камерой
  useEffect(() => {
    if (!camera) return;
    XrInteractionManager.init(camera);
  }, [camera]);

  // Завершение сессии
  useEffect(() => {
    return () => XrInteractionManager.destroy();
  }, []);

  // Обновление состояния контроллера
  useEffect(() => {
    XrInteractionManager.updateController(controllers.right, isPresenting);
  }, [controllers.right, isPresenting]);

  // Навешиваем обработчики на canvas для десктоп режима
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const handleClick = (e: MouseEvent) => XrInteractionManager.handleMouseEvent('click', e);
    const handleMouseMove = (e: MouseEvent) => XrInteractionManager.handleMouseEvent('mousemove', e);
    const handleMouseDown = (e: MouseEvent) => XrInteractionManager.handleMouseEvent('mousedown', e);
    const handleMouseUp = (e: MouseEvent) => XrInteractionManager.handleMouseEvent('mouseup', e);

    canvas.addEventListener('click', handleClick);
    // canvas.addEventListener('mousemove', handleMouseMove);
    // canvas.addEventListener('mousedown', handleMouseDown);
    // canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gl]);

  // Обработка триггера контроллера для VR режима
  useEffect(() => {
    if (!isPresenting) return;

    let frameId: number;

    const checkTrigger = () => {
      const isPressed = controllers.right?.buttons.trigger.pressed ?? false;

      // Триггер только что нажат
      if (isPressed && !lastTriggerStateRef.current) {
        XrInteractionManager.handleTriggerPress();
      }

      lastTriggerStateRef.current = isPressed;
      frameId = requestAnimationFrame(checkTrigger);
    };

    frameId = requestAnimationFrame(checkTrigger);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isPresenting, controllers.right]);

  return null;
}
