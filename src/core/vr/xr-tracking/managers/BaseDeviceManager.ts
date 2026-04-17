import * as THREE from 'three';
import { XRStore } from '../store/XRStore';
import {WebGLRenderer} from "three";

export abstract class BaseDeviceManager {
  protected store: XRStore;
  protected gl: WebGLRenderer;
  protected session: XRSession | null = null;

  // Временные объекты для избежания аллокаций
  protected tempVec3 = new THREE.Vector3();
  protected tempQuat = new THREE.Quaternion();

  constructor(gl: WebGLRenderer) {
    this.store = XRStore.getInstance();
    this.gl = gl;
  }

  abstract update(frame: XRFrame): void;
  abstract reset(): void;

  setSession(session: XRSession | null) {
    this.session = session;
    if (!session) {
      this.reset();
    }
  }
}
