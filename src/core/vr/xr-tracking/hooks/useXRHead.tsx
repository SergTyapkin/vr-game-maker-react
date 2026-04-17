import {useEffect, useRef, useReducer} from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useXR } from './useXR';

export interface HeadState {
  leftPosition: THREE.Vector3;
  rightPosition: THREE.Vector3;
  centerPosition: THREE.Vector3;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

// Функция создания состояния (вынесена отдельно)
const getZeroGlobalState = (): HeadState => ({
  leftPosition: new THREE.Vector3(),
  rightPosition: new THREE.Vector3(),
  centerPosition: new THREE.Vector3(),
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
});

// Глобальный синглтон с оптимизированными структурами
let globalState: HeadState = getZeroGlobalState();
let globalListeners: Set<() => void> = new Set();
let globalFrameId: number | null = null;
let currentSession: XRSession | null = null;
let currentGL: any = null;

// Переиспользуемые объекты (минимизация аллокаций)
const tempLeftPos = new THREE.Vector3();
const tempRightPos = new THREE.Vector3();
const tempCenterPos = new THREE.Vector3();

// Единый цикл обновления
const startGlobalXRFrame = () => {
  if (globalFrameId || !currentSession || !currentGL) return;

  const onXRFrame = (time: number, frame: XRFrame) => {
    const referenceSpace = currentGL.xr.getReferenceSpace();

    if (referenceSpace) {
      const viewerPose = frame.getViewerPose(referenceSpace);
      if (viewerPose && viewerPose.views?.length >= 2) {
        const leftView = viewerPose.views[0];
        const rightView = viewerPose.views[1];

        // Обновляем временные векторы
        tempLeftPos.set(
          leftView.transform.position.x,
          leftView.transform.position.y,
          leftView.transform.position.z
        );
        tempRightPos.set(
          rightView.transform.position.x,
          rightView.transform.position.y,
          rightView.transform.position.z
        );

        // Вычисляем центр между глазами
        tempCenterPos.copy(tempLeftPos).add(tempRightPos).multiplyScalar(0.5);

        // Обновляем глобальное состояние
        if (globalState) {
          globalState.leftPosition.copy(tempLeftPos);
          globalState.rightPosition.copy(tempRightPos);
          globalState.centerPosition.copy(tempCenterPos);
          globalState.position.set(
            viewerPose.transform.position.x,
            viewerPose.transform.position.y,
            viewerPose.transform.position.z,
          );
          globalState.quaternion.set(
            viewerPose.transform.orientation.x,
            viewerPose.transform.orientation.y,
            viewerPose.transform.orientation.z,
            viewerPose.transform.orientation.w
          );
        }

        // Уведомляем всех слушателей
        globalListeners.forEach(listener => listener());
      }
    }

    // Запрашиваем следующий кадр
    globalFrameId = currentSession!.requestAnimationFrame(onXRFrame);
  };

  globalFrameId = currentSession.requestAnimationFrame(onXRFrame);
};

// Функция остановки цикла
const stopGlobalXRFrame = () => {
  if (globalFrameId && currentSession) {
    currentSession.cancelAnimationFrame(globalFrameId);
    globalFrameId = null;
  }
};

// Хук для доступа к глобальному состоянию
export function useXRHead(): HeadState {
  const { gl } = useThree();
  const { session, isPresenting } = useXR();

  // Используем useRef для хранения версии обновления
  const versionRef = useRef(0);
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Эффект для управления глобальным состоянием и циклом
  useEffect(() => {
    if (!isPresenting || !session) {
      // Если не в XR режиме, очищаем состояние
      globalState = getZeroGlobalState();
      stopGlobalXRFrame();
      currentSession = null;
      currentGL = null;
      forceUpdate();
      return;
    }

    // Сохраняем текущие session и gl
    currentSession = session;
    currentGL = gl;

    // Запускаем цикл
    startGlobalXRFrame();

    // Создаем слушатель для этого компонента
    const listener = () => {
      versionRef.current++;
      forceUpdate();
    };

    globalListeners.add(listener);

    // Первоначальное обновление
    listener();

    // Очистка при размонтировании
    return () => {
      globalListeners.delete(listener);

      // Если не осталось слушателей, останавливаем цикл
      if (globalListeners.size === 0) {
        stopGlobalXRFrame();
        currentSession = null;
        currentGL = null;
      }
    };
  }, [gl, session, isPresenting]);

  return globalState;
}
