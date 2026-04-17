import {useThree} from "@react-three/fiber";
import {useEffect, useRef} from "react";
import {PerspectiveCamera} from "three";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";

export function ResizeHandler() {
  const { camera, gl } = useThree();
  const { isPresenting } = useXR();


  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (!isPresenting) {
          // В обычном режиме адаптируемся к окну
          (camera as PerspectiveCamera).aspect = window.innerWidth / window.innerHeight;
          gl.setSize(window.innerWidth, window.innerHeight);
        } else {
          // В XR режиме aspect управляется устройством
          // Но можно обновить pixel ratio (срезаем до 2 максимум)
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
        camera.updateProjectionMatrix();
      }, 100); // Debounce
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [camera, gl, isPresenting]);

  return null;
}
