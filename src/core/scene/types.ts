// core/scene/types.ts
import * as THREE from 'three';

export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone';
export type LightType = 'ambient' | 'directional' | 'point' | 'spot';
export type ObjectType = 'primitive' | 'model' | 'light' | 'effect' | 'empty';

export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface SceneObjectBase {
  id: string;
  name: string;
  type: ObjectType;
  transform: Transform;
  visible: boolean;
  locked: boolean;
  parentId?: string;
  children: string[];
}

export interface PrimitiveObject extends SceneObjectBase {
  type: 'primitive';
  primitiveType: PrimitiveType;
  params: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    radiusTop?: number;
    radiusBottom?: number;
    radialSegments?: number;
    tubularSegments?: number;
    arc?: number;
  };
  materialId?: string;
  color?: string;
}

export interface ModelObject extends SceneObjectBase {
  type: 'model';
  modelId: string;
  modelUrl: string;
  materialOverrides?: Record<string, string>;
  animations?: {
    name: string;
    playing: boolean;
    loop: boolean;
    speed: number;
  }[];
}

export interface LightObject extends SceneObjectBase {
  type: 'light';
  lightType: LightType;
  params: {
    color: string;
    intensity: number;
    distance?: number;
    decay?: number;
    angle?: number;
    penumbra?: number;
    castShadow?: boolean;
    shadowMapSize?: number;
  };
}

export interface EffectObject extends SceneObjectBase {
  type: 'effect';
  effectType: 'particles' | 'fog' | 'skybox' | 'postprocess';
  params: Record<string, any>;
}

export interface ComponentInstance {
  id: string;
  scriptName: string;
  state: Record<string, any>;
  enabled: boolean;
}

export interface SceneObject extends SceneObjectBase {
  components: ComponentInstance[];
}

export type AnySceneObject = PrimitiveObject | ModelObject | LightObject | EffectObject;

export interface SceneData {
  id: string;
  name: string;
  description?: string;
  objects: Record<string, AnySceneObject>;
  rootObjects: string[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    thumbnail?: string;
  };
  settings: {
    ambientLight: {
      color: string;
      intensity: number;
    };
    fog?: {
      type: 'linear' | 'exp' | 'exp2';
      color: string;
      near?: number;
      far?: number;
      density?: number;
    };
    skybox?: {
      type: 'color' | 'cubemap' | 'equirect';
      value: string;
    };
    physics?: {
      enabled: boolean;
      gravity: [number, number, number];
    };
  };
}

export interface SceneChange {
  type: 'add' | 'remove' | 'update' | 'transform' | 'component' | 'settings';
  target: string;
  data: any;
  source: 'editor' | 'vr' | 'script';
  timestamp: number;
}

export interface SceneSnapshot {
  sceneId: string;
  data: SceneData;
  timestamp: number;
}
