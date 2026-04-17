import * as THREE from 'three';
import { BaseDeviceManager } from '../BaseDeviceManager';
import { ControllerState } from '../../store/XRStore';

export class ControllerManager extends BaseDeviceManager {
  private createInitialState(handedness: XRHandedness): ControllerState {
    return {
      handedness,
      gripPosition: new THREE.Vector3(),
      gripQuaternion: new THREE.Quaternion(),
      targetRayPosition: new THREE.Vector3(),
      targetRayQuaternion: new THREE.Quaternion(),
      buttons: {
        trigger: { value: 0, pressed: false, touched: false },
        grip: { value: 0, pressed: false, touched: false },
      },
      thumbstick: { x: 0, y: 0, pressed: false, touched: false },
      gamepad: null,
      profiles: [],
      isConnected: false,
      lastSeen: 0,
    };
  }

  private updateFromGamepad(state: ControllerState, gamepad: Gamepad) {
    if (gamepad.buttons.length < 5) return;

    state.buttons.trigger = {
      value: gamepad.buttons[0]?.value ?? 0,
      pressed: gamepad.buttons[0]?.pressed ?? false,
      touched: gamepad.buttons[0]?.touched ?? false,
    };

    state.buttons.grip = {
      value: gamepad.buttons[1]?.value ?? 0,
      pressed: gamepad.buttons[1]?.pressed ?? false,
      touched: gamepad.buttons[1]?.touched ?? false,
    };

    if (gamepad.axes.length >= 4) {
      state.thumbstick = {
        x: gamepad.axes[2] ?? 0,
        y: gamepad.axes[3] ?? 0,
        pressed: gamepad.buttons[3]?.pressed ?? false,
        touched: gamepad.buttons[3]?.touched ?? false,
      };
    }

    if (gamepad.buttons.length >= 6) {
      if (state.handedness === 'right') {
        state.buttons.a = {
          value: gamepad.buttons[4]?.value ?? 0,
          pressed: gamepad.buttons[4]?.pressed ?? false,
          touched: gamepad.buttons[4]?.touched ?? false,
        };
        state.buttons.b = {
          value: gamepad.buttons[5]?.value ?? 0,
          pressed: gamepad.buttons[5]?.pressed ?? false,
          touched: gamepad.buttons[5]?.touched ?? false,
        };
      } else {
        state.buttons.x = {
          value: gamepad.buttons[4]?.value ?? 0,
          pressed: gamepad.buttons[4]?.pressed ?? false,
          touched: gamepad.buttons[4]?.touched ?? false,
        };
        state.buttons.y = {
          value: gamepad.buttons[5]?.value ?? 0,
          pressed: gamepad.buttons[5]?.pressed ?? false,
          touched: gamepad.buttons[5]?.touched ?? false,
        };
      }
    }

    state.gamepad = gamepad;
  }

  update(frame: XRFrame) {
    if (!this.session || !this.gl?.xr) return;

    const referenceSpace = this.gl.xr.getReferenceSpace();
    if (!referenceSpace) return;

    const updatedHandedness = new Set<XRHandedness>();

    this.session.inputSources.forEach(inputSource => {
      if (!inputSource.handedness || inputSource.handedness === 'none') return;

      const handedness = inputSource.handedness;
      updatedHandedness.add(handedness);

      let state = this.store.controllers[handedness];
      if (!state) {
        // Контроллер только что подключился!
        state = this.createInitialState(handedness);
        this.store.controllers[handedness] = state;
        this.notifyControllerConnected(handedness);
      }

      // Обновляем состояние подключения
      state.isConnected = true;
      state.lastSeen = Date.now();

      const gripPose = inputSource.gripSpace
        ? frame.getPose(inputSource.gripSpace, referenceSpace)
        : null;
      const targetRayPose = inputSource.targetRaySpace
        ? frame.getPose(inputSource.targetRaySpace, referenceSpace)
        : null;

      if (gripPose) {
        state.gripPosition.set(
          gripPose.transform.position.x,
          gripPose.transform.position.y,
          gripPose.transform.position.z
        );
        state.gripQuaternion.set(
          gripPose.transform.orientation.x,
          gripPose.transform.orientation.y,
          gripPose.transform.orientation.z,
          gripPose.transform.orientation.w
        );
      }

      if (targetRayPose) {
        state.targetRayPosition.set(
          targetRayPose.transform.position.x,
          targetRayPose.transform.position.y,
          targetRayPose.transform.position.z
        );
        state.targetRayQuaternion.set(
          targetRayPose.transform.orientation.x,
          targetRayPose.transform.orientation.y,
          targetRayPose.transform.orientation.z,
          targetRayPose.transform.orientation.w
        );
      }

      if (inputSource.gamepad) {
        this.updateFromGamepad(state, inputSource.gamepad);
      }

      state.profiles = inputSource.profiles || [];
    });

    // Проверяем, какие контроллеры потеряны
    ['left', 'right'].forEach(handedness => {
      const state = this.store.controllers[handedness as XRHandedness];
      if (state && state.isConnected && !updatedHandedness.has(handedness as XRHandedness)) {
        // Контроллер отключился!
        state.isConnected = false;
        this.notifyControllerDisconnected(handedness as XRHandedness);
      }
    });

    if (updatedHandedness.size > 0) {
      this.store.notify('controllers');
    }
  }

  private notifyControllerConnected(handedness: XRHandedness) {
    console.log(`🎮 Controller connected: ${handedness}`);
    this.store.notify('controllers');
  }

  private notifyControllerDisconnected(handedness: XRHandedness) {
    console.log(`🎮 Controller disconnected: ${handedness}`);
    this.store.notify('controllers');
  }

  reset() {
    this.store.controllers.left = null;
    this.store.controllers.right = null;
    this.store.notify('controllers');
  }
}
