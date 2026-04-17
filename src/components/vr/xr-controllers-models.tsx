import {useThree} from '@react-three/fiber';
import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from "three-stdlib";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";
import {useXRControllerEvents, useXRControllers} from "@/core/vr/xr-tracking/hooks/useXRControllers";
import {ControllerState} from "@/core/vr/xr-tracking/store/XRStore";
import {CONTROLLER_RAY_DIR_VECTOR, CONTROLLER_RAY_START_POS} from "@/core/vr/constants";


// Константы для анимаций контроллера
const TOUCHED_COLOR = new THREE.Color(0x888888);
const UNTOUCHED_COLOR = new THREE.Color(0x000000);
const BUTTON_PRESSING_Z_OFFSET = 0.002;
const RAY_LENGTH = 10;
const RAY_LENGTH_ACTIVATED = 100;
const ANIMATION_LERP_FACTOR = 0.2;
//-------------------------------------

type ControllerPhysicalPartInfo = {
  mesh: THREE.Mesh,
  position: THREE.Vector3,
  rotation: THREE.Euler,
}
type ControllerPhysicalParts = {
  body: ControllerPhysicalPartInfo;
  buttonB: ControllerPhysicalPartInfo;
  buttonA: ControllerPhysicalPartInfo;
  // buttonOptions: ControllerPhysicalPartInfo;
  // buttonExit: ControllerPhysicalPartInfo;
  thumbstick: ControllerPhysicalPartInfo;
  grip: ControllerPhysicalPartInfo;
  trigger: ControllerPhysicalPartInfo;
}
type ControllerParams = ControllerPhysicalParts & {
  model: THREE.Group;
  ray: THREE.Line;
}

// Модели контроллеров (можно заменить на свои)
const CONTROLLER_MODELS = {
  left: {
    url: '/assets/models/controller-left.glb',
    meshesIdxesToParts: {
      0: 'body',
      1: 'buttonA',
      2: 'grip',
      3: 'thumbstick',
      4: 'trigger',
      5: 'buttonB',
    } as Record<number, keyof ControllerPhysicalParts>,
  },
  right: {
    url: '/assets/models/controller-right.glb',
    meshesIdxesToParts: {
      0: 'buttonA',
      1: 'buttonB',
      2: 'body',
      3: 'grip',
      4: 'thumbstick',
      5: 'trigger',
    } as Record<number, keyof ControllerPhysicalParts>,
  },
};


export function XRControllersModels() {
  const {gl, scene} = useThree();
  const {session, isPresenting} = useXR();
  const {left: leftState, right: rightState} = useXRControllers();
  const controllersRef = useRef<Map<XRHandedness, ControllerParams>>(new Map());
  const loader = useRef(new GLTFLoader());
  const xrFrameIdRef = useRef<number | null>(null);
  const tmpPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const tmpColorRef = useRef<THREE.Color>(new THREE.Color());

  // Загрузка модели контроллера
  const loadControllerModel = async (handedness: XRHandedness, controller?: ControllerState) => {
    if (handedness === 'none') {
      console.warn('Unknown handedness of controller "none". No model for it');
      return null;
    }

    const controllerState =
      controller ??
      (handedness === 'left' ? leftState : rightState);
    if (!controllerState) return null;

    try {
      const url = CONTROLLER_MODELS[handedness].url;
      const gltf = await loader.current.loadAsync(url);
      const model = gltf.scene;

      // Настройка материала и парсинг составляющих частей
      // @ts-expect-error Все поля будут заполнены в цикле ниже
      const controllerParts: ControllerPhysicalParts = {};
      let i = 0;
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Записываем mesh в правильное поле в controllerParts, которые мы определили заранее по индексам в модели
          controllerParts[CONTROLLER_MODELS[handedness].meshesIdxesToParts[i]] = {
            mesh: child,
            position: child.position.clone(),
            rotation: child.rotation.clone(),
          };
          child.material = new THREE.MeshStandardMaterial({
            color: 0xCCCCCC,
            roughness: 0.4,
            metalness: 0.2,
          });
          i++;
        }
      });

      (controllerParts.body.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x999999);
      (controllerParts.body.mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

      // Создаем луч
      const rayMaterial = new THREE.LineBasicMaterial(
        {
          color: handedness === 'left' ? '#ff8888' : '#8888ff',
          linecap: 'round',
          linejoin: 'round',
          linewidth: 3,
        }
      );
      const rayVector = CONTROLLER_RAY_DIR_VECTOR.clone().multiplyScalar(RAY_LENGTH);
      const endRayPos = CONTROLLER_RAY_START_POS.clone().add(rayVector);

      const rayGeometry = new THREE.BufferGeometry().setFromPoints([
        CONTROLLER_RAY_START_POS,
        endRayPos,
      ]);
      const ray = new THREE.Line(rayGeometry, rayMaterial);

      model.add(ray);
      scene?.add(model);

      controllersRef.current.set(handedness, {
        model: model,
        ray: ray,
        ...controllerParts,
      });

      return {model, ray};
    } catch (error) {
      console.error('Failed to load controller model, using fallback', error);
      return null;
    }
  };

  const onControllerConnected = (handedness: XRHandedness, controllerState: ControllerState) => {
    const controller = controllersRef.current.get(handedness);
    console.log("CONNECT", handedness, controller, controllerState);

    // Удаляем уже существующии модели для этой руки
    if (controller) {
      scene?.remove(controller.model);
      controllersRef.current.delete(handedness);
    }

    // Создаем новую модель
    loadControllerModel(handedness, controllerState);
  }

  const onControllerDisconnected = (handedness: XRHandedness) => {
    const controller = controllersRef.current.get(handedness);
    if (!controller) return;

    scene?.remove(controller.model);
    controllersRef.current.delete(handedness);
  };

  useXRControllerEvents({
    onConnected: onControllerConnected,
    onDisconnected: onControllerDisconnected,
  });

  // Загрузка моделей
  useEffect(() => {
    if (!session || !isPresenting) return;

    const clearExistingModels = () => {
      controllersRef.current.forEach(controller => {
        scene?.remove(controller.model);
      });
      controllersRef.current.clear();
    };

    clearExistingModels();
    session.inputSources.forEach(inputSource => {
      if (!inputSource.handedness) return;
      loadControllerModel(inputSource.handedness);
    });

    return clearExistingModels;
  }, [session, isPresenting, scene]);

  // ЕДИНЫЙ XR цикл для обновления позиций И анимации
  useEffect(() => {
    if (!gl.xr || !session || !isPresenting) return;

    const onXRFrame = (time: number, frame: XRFrame) => {
      const currentSession = frame.session;
      const referenceSpace = gl.xr.getReferenceSpace();

      if (currentSession && referenceSpace) {
        // 1. Обновляем позиции контроллеров
        currentSession.inputSources.forEach(inputSource => {
          if (!inputSource.handedness || !inputSource.gripSpace) return;

          const controllerState = (inputSource.handedness === 'left' ? leftState : rightState);
          if (!controllerState) return;
          const gripPosition = controllerState.gripPosition;
          const gripQuaternion = controllerState.gripQuaternion;

          const controller = controllersRef.current.get(inputSource.handedness);
          if (!controller) return;

          // Обновляем позицию и поворот модели
          controller.model.position.copy(gripPosition);
          controller.model.quaternion.copy(gripQuaternion);
        });

        // 2. Обновляем анимации на основе состояния кнопок
        controllersRef.current.forEach((controller, handedness) => {
          const state = handedness === 'left' ? leftState : rightState;
          if (!state) return;

          // Анимация кнопок
          const animatePressable = (part: ControllerPhysicalPartInfo, pressed: boolean) => {
            if (!part) return;
            // Используем позицию из state, а не сохраненную оригинальную
            tmpPosRef.current.copy(part.position);
            tmpPosRef.current.y -= (pressed ? BUTTON_PRESSING_Z_OFFSET : 0);
            // Анимация плавного нажатия на кнопку
            part.mesh.position.lerp(tmpPosRef.current, ANIMATION_LERP_FACTOR);
          };

          // Анимация любых сенсорных элементов - зажигает их при касании
          const animateTouchable = (part: ControllerPhysicalPartInfo, touched: boolean) => {
            if (!part?.mesh?.material) return;
            const material = part.mesh.material as THREE.MeshStandardMaterial;
            tmpColorRef.current.copy(material.emissive).lerp(touched ? TOUCHED_COLOR : UNTOUCHED_COLOR, ANIMATION_LERP_FACTOR);
            material.emissive.copy(tmpColorRef.current);
          };

          // Триггер
          if (controller.trigger) {
            const triggerValue = state.buttons.trigger?.value ?? 0;
            controller.trigger.mesh.rotation.x = controller.trigger.rotation.x - triggerValue * 0.1;
            animateTouchable(controller.trigger, state.buttons.trigger.touched);
          }

          // Grip
          if (controller.grip) {
            const gripValue = state.buttons.grip?.value || 0;
            controller.grip.mesh.rotation.y = controller.grip.rotation.y
              - gripValue * 0.05 * (handedness === 'left' ? -1 : 1);
            animateTouchable(controller.grip, state.buttons.grip.touched);
          }

          // Джойстик
          if (controller.thumbstick) {
            const joyX = state.thumbstick.x ?? 0;
            const joyY = state.thumbstick.y ?? 0;

            controller.thumbstick.mesh.position.x = controller.thumbstick.position.x + joyX * 0.003;
            controller.thumbstick.mesh.position.z = controller.thumbstick.position.z + joyY * 0.003;

            animatePressable(controller.thumbstick, state.thumbstick.pressed);
            animateTouchable(controller.thumbstick, state.thumbstick.touched);
          }

          // Кнопки A/X
          if (controller.buttonA) {
            const buttonState = handedness === 'left' ? state.buttons.x : state.buttons.a;
            animatePressable(controller.buttonA, !!buttonState?.pressed);
            animateTouchable(controller.buttonA, !!buttonState?.touched);
          }

          // Кнопки B/Y
          if (controller.buttonB) {
            const buttonState = handedness === 'left' ? state.buttons.y : state.buttons.b;
            animatePressable(controller.buttonB, !!buttonState?.pressed);
            animateTouchable(controller.buttonB, !!buttonState?.touched);
          }

          // Луч
          if (controller.ray) {
            const triggerPressed = !!state.buttons.trigger?.pressed;
            (controller.ray.material as THREE.LineBasicMaterial).color.setHex(
              triggerPressed ? 0xffffff : (handedness === 'left' ? 0xff8888 : 0x8888ff)
            );

            const triggerValue = state.buttons.trigger?.value ?? 0;
            const rayLength = RAY_LENGTH + (RAY_LENGTH_ACTIVATED - RAY_LENGTH) * triggerValue;
            const rayVector = CONTROLLER_RAY_DIR_VECTOR.clone().multiplyScalar(rayLength);
            const endRayPos = CONTROLLER_RAY_START_POS.clone().add(rayVector);

            const points = [
              CONTROLLER_RAY_START_POS,
              endRayPos,
            ];
            controller.ray.geometry.setFromPoints(points);
          }
        });
      }

      // Запрашиваем следующий XR кадр
      xrFrameIdRef.current = currentSession.requestAnimationFrame(onXRFrame);
    };

    // Запускаем XR цикл
    xrFrameIdRef.current = session.requestAnimationFrame(onXRFrame);

    return () => {
      if (xrFrameIdRef.current) {
        session.cancelAnimationFrame(xrFrameIdRef.current);
      }
    };
  }, [gl, session, isPresenting, leftState, rightState]);

  return null;
}
