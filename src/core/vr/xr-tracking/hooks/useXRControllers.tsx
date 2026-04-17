import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import {ControllerState, XRStore} from '../store/XRStore';
import {useXR} from './useXR';


// Главный хук для контроллеров
export function useXRControllers() {
  useXR();
  const store = XRStore.getInstance();

  const left = useSyncExternalStore(
    (callback) => store.subscribe('controllers', callback),
    () => store.controllers.left,
    () => null,
  );

  const right = useSyncExternalStore(
    (callback) => store.subscribe('controllers', callback),
    () => store.controllers.right,
    () => null,
  );

  // Мемоизируем результат
  return useMemo(() => ({left, right}), [left, right]);
}


// Хук с колбэками
export function useXRControllerEvents(
  {
    onConnected,
    onDisconnected,
  }: {
    onConnected?: (handedness: XRHandedness, controller: ControllerState) => void;
    onDisconnected?: (handedness: XRHandedness, controller: ControllerState) => void;
  }) {
  useXR();
  const store = XRStore.getInstance();
  const leftWasConnected = useRef(false);
  const rightWasConnected = useRef(false);

  const left = useSyncExternalStore(
    (callback) => store.subscribe('controllers', callback),
    () => store.controllers.left,
    () => null,
  );

  const right = useSyncExternalStore(
    (callback) => store.subscribe('controllers', callback),
    () => store.controllers.right,
    () => null,
  );

  useEffect(() => {
    const leftConnected = left?.isConnected ?? false;
    const rightConnected = right?.isConnected ?? false;

    // Левый контроллер
    if (leftConnected && !leftWasConnected.current) {
      onConnected?.('left', left!);
    }
    if (!leftConnected && leftWasConnected.current) {
      onDisconnected?.('left', left!);
    }
    leftWasConnected.current = leftConnected;

    // Правый контроллер
    if (rightConnected && !rightWasConnected.current) {
      onConnected?.('right', right!);
    }
    if (!rightConnected && rightWasConnected.current) {
      onDisconnected?.('right', right!);
    }
    rightWasConnected.current = rightConnected;
  }, [left?.isConnected, right?.isConnected, onConnected, onDisconnected]);
}
