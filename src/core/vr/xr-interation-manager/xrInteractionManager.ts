'use client';

import * as THREE from 'three';
import {ControllerState} from "@/core/vr/xr-tracking/store/XRStore";
import {InteractiveObject} from "@/core/vr/xr-tracking/hooks/useInteractive";
import {CONTROLLER_RAY_DIR_VECTOR, CONTROLLER_RAY_START_POS} from "@/core/vr/constants";

class XRInteractionManagerClass {
  private static instance: XRInteractionManagerClass;

  private interactiveObjects: Map<string, InteractiveObject> = new Map();
  private lastHoveredId: string | null = null;

  private camera: THREE.Camera | null = null;
  private rightController: ControllerState | null = null;
  private isPresenting = false;
  private rafId: number | null = null;

  // Временные объекты
  private tempRay = new THREE.Ray();
  private raycaster = new THREE.Raycaster();

  private constructor() {}

  static getInstance(): XRInteractionManagerClass {
    if (!XRInteractionManagerClass.instance) {
      XRInteractionManagerClass.instance = new XRInteractionManagerClass();
    }
    return XRInteractionManagerClass.instance;
  }

  // Инициализация
  init(camera: THREE.Camera) {
    this.camera = camera;
    // if (!this.rafId) this.startLoop();
  }

  // Обновление состояния контроллера
  updateController(controller: ControllerState | null, isPresenting: boolean) {
    this.rightController = controller;
    this.isPresenting = isPresenting;
  }

  // Регистрация интерактивного объекта
  register(id: string, obj: InteractiveObject): () => void {
    const existingObj = this.interactiveObjects.get(id);
    if (existingObj) {
      console.warn(`[XRInteractionManagerClass] Object already registered: ${id}`, existingObj);
      return () => {};
    }
    this.interactiveObjects.set(id, obj);
    console.log(`[XRInteractionManagerClass] Registered: ${id}`, obj);
    return () => {
      console.log(`[XRInteractionManagerClass] Unregistered: ${id}`, obj);
      this.interactiveObjects.delete(id);
    };
  }

  // Получение луча из контроллера
  private getControllerRay(): THREE.Ray | null {
    if (!this.rightController) return null;

    this.tempRay.origin.copy(
      this.rightController.gripPosition.clone()
        .add(CONTROLLER_RAY_START_POS)
    );
    this.tempRay.direction.copy(
      CONTROLLER_RAY_DIR_VECTOR.clone()
        .applyQuaternion(this.rightController.gripQuaternion)
        .normalize()
    );
    return this.tempRay;
  }

// Получение луча из камеры по экранным координатам
  private getCameraRayFromScreenPoint(screenX: number, screenY: number): THREE.Ray | null {
    if (!this.camera) return null;

    // Получаем canvas
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;

    // Получаем координаты относительно canvas
    const rect = canvas.getBoundingClientRect();
    if (!rect) {
      // Fallback: используем весь экран
      const x = (screenX / window.innerWidth) * 2 - 1;
      const y = -(screenY / window.innerHeight) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
      return raycaster.ray;
    }

    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    console.log('[XRInteractionManager] Mouse at', screenX, screenY, 'NDC:', x, y);

    return raycaster.ray;
  }

  // Получение луча
  private getRay(clickX?: number, clickY?: number): THREE.Ray | null {
    if (this.isPresenting && this.rightController) {
      return this.getControllerRay();
    } else if (!this.isPresenting && this.camera && clickX !== undefined && clickY !== undefined) {
      return this.getCameraRayFromScreenPoint(clickX, clickY);
    }
    return null;
  }

  // Проверка пересечения с мешем
  private checkIntersection(ray: THREE.Ray, mesh: THREE.Mesh): { hit: boolean; uv?: THREE.Vector2; point?: THREE.Vector3 } {
    if (!mesh.geometry) return { hit: false };

    mesh.updateWorldMatrix(true, false);

    // Преобразуем луч в локальные координаты меша
    const inverseMatrix = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const localRay = ray.clone().applyMatrix4(inverseMatrix);

    const geometry = mesh.geometry;
    const indices = geometry.index?.array;
    const positions = geometry.attributes.position.array;

    if (!indices) return { hit: false };

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const point = new THREE.Vector3();

    // Проверяем все треугольники
    for (let i = 0; i < indices.length / 3; i += 1) {
      const i1 = indices[i * 3] * 3;
      const i2 = indices[i * 3 + 1] * 3;
      const i3 = indices[i * 3 + 2] * 3;

      a.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      b.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);
      c.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);

      if (localRay.intersectTriangle(a, b, c, true, point)) {
        // Преобразуем точку обратно в мировые координаты
        const worldPoint = point.clone().applyMatrix4(mesh.matrixWorld);

        // Для UV координат нужно интерполировать UV атрибуты
        let uv: THREE.Vector2 | undefined;
        if (geometry.attributes.uv) {
          const uvi1 = indices[i * 3] * 2;
          const uvi2 = indices[i * 3 + 1] * 2;
          const uvi3 = indices[i * 3 + 2] * 2;
          const uvs = geometry.attributes.uv.array;
          const uv1 = new THREE.Vector2(uvs[uvi1], uvs[uvi1 + 1]);
          const uv2 = new THREE.Vector2(uvs[uvi2], uvs[uvi2 + 1]);
          const uv3 = new THREE.Vector2(uvs[uvi3], uvs[uvi3 + 1]);

          // Вычисляем барицентрические координаты
          const bary = this.calculateBarycentric(point, a, b, c);

          // Интерполируем UV
          uv = new THREE.Vector2(
            uv1.x * bary.x + uv2.x * bary.y + uv3.x * bary.z,
            uv1.y * bary.x + uv2.y * bary.y + uv3.y * bary.z
          );
        }

        return { hit: true, uv, point: worldPoint };
      }
    }

    return { hit: false };
  }

  private calculateBarycentric(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    const v0 = new THREE.Vector3().subVectors(b, a);
    const v1 = new THREE.Vector3().subVectors(c, a);
    const v2 = new THREE.Vector3().subVectors(p, a);

    const d00 = v0.dot(v0);
    const d01 = v0.dot(v1);
    const d11 = v1.dot(v1);
    const d20 = v2.dot(v0);
    const d21 = v2.dot(v1);
    const denom = d00 * d11 - d01 * d01;

    // Защита от вырожденных треугольников
    if (Math.abs(denom) < 1e-8) {
      return new THREE.Vector3(1/3, 1/3, 1/3); // центр треугольника
    }

    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1 - v - w;

    return new THREE.Vector3(u, v, w);
  }

  private getClosestMeshOnRay(ray: THREE.Ray) {
    // Собираем все меши
    const meshes: THREE.Mesh[] = [];
    const meshToIdMap = new Map<THREE.Mesh, string>();

    console.log("all objects", this.interactiveObjects)
    for (const [id, obj] of this.interactiveObjects.entries()) {
      if (!obj.enabled) continue;

      // Обновляем мировую матрицу
      obj.meshRef.current.updateWorldMatrix(true, false);

      meshes.push(obj.meshRef.current);
      meshToIdMap.set(obj.meshRef.current, id);
    }

    if (meshes.length === 0) return null;

    // Используем встроенный raycaster
    this.raycaster.ray.copy(ray);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    console.log('[XRInteractionManager] Ray origin:', ray.origin);
    console.log('[XRInteractionManager] Ray direction:', ray.direction);
    console.log('[XRInteractionManager] Intersects:', intersects.length);

    console.log(intersects, ray, meshes);
    if (intersects.length === 0) return null;

    // Берем первый (ближайший) intersection
    const hit = intersects[0];
    const id = meshToIdMap.get(hit.object as THREE.Mesh);

    if (!id) return null;

    const obj = this.interactiveObjects.get(id);
    if (!obj) return null;

    console.log('[XRInteractionManager] HIT object:', id, 'at point:', hit.point);

    return {
      id,
      obj,
      uv: hit.uv || new THREE.Vector2(),
      point: hit.point
    };
  }


  // Обработка клика
  private processEvent(eventName: string, clickX?: number, clickY?: number) {
    const ray = this.getRay(clickX, clickY);
    if (!ray) return;

    const closest = this.getClosestMeshOnRay(ray);
    console.log(eventName, closest, ray);
    if (!closest) return;

    // По клику вызываем onCLick элемента
    if (eventName === 'click') {
      console.log('[XRInteractionManager] CLICK on:', closest.id, closest);
      closest.obj.onClick?.(closest.uv, closest.point);
    }

    // По любому событию обрабытываем hover состояние
    const closestId = closest?.id ?? null;
    if (this.lastHoveredId !== closestId) {
      if (this.lastHoveredId) {
        this.interactiveObjects.get(this.lastHoveredId)?.onHover?.(false);
      }
      if (closestId) {
        this.interactiveObjects.get(closestId)?.onHover?.(true, closest.uv, closest.point);
      }
      this.lastHoveredId = closestId;
    }
  }

  // Функция для внешнего вызова по обработчикам
  handleMouseEvent(eventName: string, event: MouseEvent) {
    if (this.isPresenting) return;
    const isVREvent = (event as any).isVREvent === true;
    if (isVREvent) return;

    this.processEvent(eventName, event.clientX, event.clientY);
  }

  handleTriggerPress() {
    if (!this.isPresenting) return;
    this.processEvent('click');
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.interactiveObjects.clear();
  }
}

export const XrInteractionManager = XRInteractionManagerClass.getInstance();
