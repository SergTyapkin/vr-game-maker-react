import * as THREE from 'three';
import { BaseDeviceManager } from '../BaseDeviceManager';
import { HeadState } from '../../store/XRStore';
import {WebGLRenderer} from "three";

export class HeadManager extends BaseDeviceManager {
  constructor(gl: WebGLRenderer) {
    super(gl);

    this.store.head = this.createInitialState();
  }

  private createInitialState(): HeadState {
    return {
      leftPosition: new THREE.Vector3(),
      rightPosition: new THREE.Vector3(),
      centerPosition: new THREE.Vector3(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
    };
  }

  update(frame: XRFrame) {
    if (!this.gl?.xr) return;

    const referenceSpace = this.gl.xr.getReferenceSpace();
    if (!referenceSpace) return;

    const viewerPose = frame.getViewerPose(referenceSpace);
    if (!viewerPose || viewerPose.views.length < 2) return;

    const leftView = viewerPose.views[0];
    const rightView = viewerPose.views[1];

    const leftPos = this.tempVec3.set(
      leftView.transform.position.x,
      leftView.transform.position.y,
      leftView.transform.position.z
    );
    const rightPos = this.tempVec3.set(
      rightView.transform.position.x,
      rightView.transform.position.y,
      rightView.transform.position.z
    );

    const centerPos = this.tempVec3.copy(leftPos).add(rightPos).multiplyScalar(0.5);

    const state = this.store.head ?? this.createInitialState();

    state.leftPosition.copy(leftPos);
    state.rightPosition.copy(rightPos);
    state.centerPosition.copy(centerPos);
    state.position.set(
      viewerPose.transform.position.x,
      viewerPose.transform.position.y,
      viewerPose.transform.position.z
    );
    state.quaternion.set(
      viewerPose.transform.orientation.x,
      viewerPose.transform.orientation.y,
      viewerPose.transform.orientation.z,
      viewerPose.transform.orientation.w
    );

    if (!this.store.head) {
      this.store.head = state;
    }

    this.store.notify('head');
  }

  reset() {
    this.store.head = null;
    this.store.notify('head');
  }
}
