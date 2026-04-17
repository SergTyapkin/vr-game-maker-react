import {useThree} from "@react-three/fiber";
import {useEffect, useRef} from "react";
import {ControllerManager} from "@/core/vr/xr-tracking/managers/DeviceManagers/ControllerManager";
import {HeadManager} from "@/core/vr/xr-tracking/managers/DeviceManagers/HeadManager";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";


export function XRManager() {
  const { gl } = useThree();
  const { session } = useXR();

  const controllerManager = useRef(new ControllerManager(gl));
  const headManager = useRef(new HeadManager(gl));

  const xrFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!session) return;

    controllerManager.current.setSession(session);
    headManager.current.setSession(session);

    startXRFrameLoop();
  }, [session]);

  const startXRFrameLoop = () => {
    if (!session || xrFrameId.current) {
      stop();
      return;
    }

    const onXRFrame = (time: number, frame: XRFrame) => {
      if (!gl?.xr?.isPresenting) {
        xrFrameId.current = null;
        return;
      }

      // Обновляем все менеджеры в одном цикле
      controllerManager.current.update(frame);
      headManager.current.update(frame);

      xrFrameId.current = session!.requestAnimationFrame(onXRFrame);
    };

    xrFrameId.current = session.requestAnimationFrame(onXRFrame);
  }

  const stop = () => {
    stopXRFrameLoop();

    controllerManager.current.setSession(null);
    headManager.current.setSession(null);
  }

  const stopXRFrameLoop = () => {
    if (xrFrameId.current) {
      session?.cancelAnimationFrame?.(xrFrameId.current);
    }
    xrFrameId.current = null;
  }

  return null;
}
