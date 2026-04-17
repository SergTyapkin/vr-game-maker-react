import {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {Html} from "@react-three/drei";
import {Layers, Light} from "three";
import {useXR} from "@/app/_lib/xr/xr-tracking/hooks/useXR";
import {useStore} from "@/app/_lib/common/store";
import {LAYERS} from "@/app/constants";



export function XrLayerSwitcher() {
  // Refs для хранения оригинальных настроек
  const originalShadowMaps = useRef<Map<Light, boolean>>(new Map());

  const activeSceneLayers = useStore((s) => s.activeSceneLayers);
  const toggleSceneLayer = useStore((s) => s.toggleSceneLayer);

  const {gl, camera, raycaster, scene} = useThree();
  const {isPresenting} = useXR();

  // Обновляем слои для XR и обычной камер при изменении activeLayers
  useEffect(() => {
    if (isPresenting) {
      // XR mode enabled
      const xrCamera = gl.xr.getCamera();
      const leftCamera = xrCamera.cameras[0];
      const rightCamera = xrCamera.cameras[1];
      // Для XR-камер включаем активные слои кроме соответствующих left и right слоёв
      activeSceneLayers.forEach(layer => {
        if (layer in [LAYERS.left, LAYERS.right]) {
          return;
        }
        [leftCamera, rightCamera].forEach(o => o.layers.enable(layer));
      });
      leftCamera.layers.enable(LAYERS.left);
      rightCamera.layers.enable(LAYERS.right);
      leftCamera.updateProjectionMatrix?.();
      rightCamera.updateProjectionMatrix?.();
    } else {
      // Сбрасываем все слои
      [camera, raycaster].forEach(o => o.layers.set(LAYERS.default));

      // Включаем активные слои
      activeSceneLayers.forEach(layer => {
        [camera, raycaster].forEach(o => o.layers.enable(layer));
      });
    }

    // Обновляем освещение и объкуты.
    // Некоторые источники света могут быть настроены на освещение только определённых слоёв
    // Объекты отбрасывают/принимают тени только на активных слоях
    scene.traverse((object: any) => {
      if (('isLight' in object) && object.isLight) {
        const light = object as Light;
        // Сохраняем оригинальные настройки теней при первом запуске
        if (!originalShadowMaps.current.has(light) && light.shadow) {
          originalShadowMaps.current.set(light, light.castShadow);
        }

        // Обновляем тени в зависимости от слоёв
        if (light.shadow) {
          // Свет отбрасывает тени только если его слой активен
          const lightLayer = light.layers;
          const isOnActiveLayer = activeSceneLayers.some(
            (l) => {
              const layer = new Layers();
              layer.set(l);
              return lightLayer.test(layer);
            }
          );
          light.castShadow = isOnActiveLayer;
        }
      }

      if (
        (('isMesh' in object) && object.isMesh) ||
        (('isGroup' in object) && object.isGroup)
      ) {
        // Тени будут работать только если объект на активном слое
        const isOnActiveLayer = activeSceneLayers.some(
          (l) => {
            const layer = new Layers();
            layer.set(l);
            return object.layers.test(layer);
          }
        );
        object.castShadow = isOnActiveLayer;
        object.receiveShadow = isOnActiveLayer;
      }
    });

    camera.updateProjectionMatrix();
  }, [camera, raycaster, activeSceneLayers, scene, gl, isPresenting]);

  return (
    <>
      <Html fullscreen style={{
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          zIndex: 1000,
          backdropFilter: 'blur(5px)',
          border: '1px solid #44444477',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          pointerEvents: 'auto',
        }}>
          <h4>Layer Control</h4>
          {Object.entries(LAYERS).slice(1).map(([name, id]) => (
            <label key={id} style={{display: 'block', margin: '5px 0'}}>
              <input
                type="checkbox"
                checked={activeSceneLayers.includes(id)}
                onChange={() => toggleSceneLayer(id)}
                style={{
                  marginRight: '10px',
                }}
              />
              Layer {name}
            </label>
          ))}
        </div>
      </Html>
    </>
  );
}
