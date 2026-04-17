import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { Vector3 } from "three";

// Константы
export const VRDeviceNames = {
  unknown: 'Unknown Device',
  oculus: 'Oculus',
  pico: 'PICO',
  vive: 'HTC Vive',
  windows: 'Windows Mixed Reality',
  google: 'Google Cardboard',
} as const;

type VRDeviceName = typeof VRDeviceNames[keyof typeof VRDeviceNames];

interface XRState {
  isPresenting: boolean;
  session: XRSession | null;
  referenceSpace: XRReferenceSpace | null;
  frameRate: number;
  supportedFrameRates: number[];
  ipd: number | null;
  deviceName: VRDeviceName;
  fps: number | null;
  renderWidth: number | null;
  renderHeight: number | null;
}

// Глобальный синглтон
class XRStateManager {
  private static instance: XRStateManager;
  private state: XRState | null = null;
  private deviceName: VRDeviceName | null = null;
  private listeners: Set<() => void> = new Set();
  private xrFrameId: number | null = null;
  private xrSession: XRSession | null = null;
  private gl: any = null;

  // Переиспользуемые объекты для избежания аллокаций
  private tempLeftPos = new Vector3();
  private tempRightPos = new Vector3();
  private lastStateJson: string = '';

  // Синглтон
  static getInstance(): XRStateManager {
    if (!XRStateManager.instance) {
      XRStateManager.instance = new XRStateManager();
    }
    return XRStateManager.instance;
  }

  // Инициализация с gl
  init(gl: any) {
    this.gl = gl;
    this.deviceName = this.detectDevice();
  }

  // Подписка
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopXRFrameLoop();
      }
    };
  }

  // Получение состояния
  getState(): XRState | null {
    return this.state;
  }

  // Обновление состояния из XRFrame
  private updateFromXRFrame(frame: XRFrame) {
    if (!this.gl?.xr || !frame) return;

    try {
      const session = this.gl.xr.getSession?.() || null;
      const referenceSpace = this.gl.xr.getReferenceSpace?.() || null;

      if (!session || !referenceSpace) return;

      let ipd: number | null = null;
      let renderWidth: number | null = null;
      let renderHeight: number | null = null;

      const viewerPose = frame.getViewerPose(referenceSpace);
      if (viewerPose && viewerPose.views.length >= 2) {
        const leftView = viewerPose.views[0];
        const rightView = viewerPose.views[1];

        // Используем переиспользуемые векторы
        this.tempLeftPos.set(
          leftView.transform.position.x,
          leftView.transform.position.y,
          leftView.transform.position.z
        );
        this.tempRightPos.set(
          rightView.transform.position.x,
          rightView.transform.position.y,
          rightView.transform.position.z
        );

        const ipdInMm = this.tempLeftPos.distanceTo(this.tempRightPos) * 1000;
        ipd = Math.round(ipdInMm * 2) / 2;

        const viewport = session.renderState.baseLayer?.getViewport(leftView);
        renderWidth = viewport?.width ?? null;
        renderHeight = viewport?.height ?? null;
      }

      const newState: XRState = {
        isPresenting: this.gl.xr.isPresenting,
        session,
        referenceSpace,
        frameRate: (session as any)?.frameRate ?? 0,
        supportedFrameRates: Array.from((session as any)?.supportedFrameRates ?? []),
        ipd,
        deviceName: this.deviceName ?? VRDeviceNames.unknown,
        fps: (session as any)?.frameRate ?? null,
        renderWidth,
        renderHeight,
      };

      // Оптимизированная проверка изменений (без JSON.stringify каждый раз)
      this.notifyIfChanged(newState);
    } catch (error) {
      console.error('Error updating XR state:', error);
    }
  }

  private detectDevice(): VRDeviceName {
    const ua = navigator.userAgent;
    if (ua.includes('PICO')) return VRDeviceNames.pico;
    if (ua.includes('Oculus')) return VRDeviceNames.oculus;
    if (ua.includes('Vive')) return VRDeviceNames.vive;
    if (ua.includes('Windows')) return VRDeviceNames.windows;
    if (ua.includes('Cardboard')) return VRDeviceNames.google;
    return VRDeviceNames.unknown;
  }

  private notifyIfChanged(newState: XRState) {
    const newStateJson = JSON.stringify(newState);
    if (this.lastStateJson !== newStateJson) {
      this.lastStateJson = newStateJson;
      this.state = newState;
      this.notifyAll();
    }
  }

  private notifyAll() {
    this.listeners.forEach(listener => listener());
  }

  // Запуск XR цикла
  startXRFrameLoop() {
    if (!this.gl?.xr?.isPresenting || this.xrFrameId) return;

    const session = this.gl.xr.getSession();
    if (!session) return;

    this.xrSession = session;

    const onXRFrame = (time: number, frame: XRFrame) => {
      if (!this.gl?.xr?.isPresenting) {
        this.xrFrameId = null;
        return;
      }

      this.updateFromXRFrame(frame);
      this.xrFrameId = session.requestAnimationFrame(onXRFrame);
    };

    this.xrFrameId = session.requestAnimationFrame(onXRFrame);
  }

  // Остановка XR цикла
  stopXRFrameLoop() {
    if (this.xrSession && this.xrFrameId) {
      this.xrSession.cancelAnimationFrame(this.xrFrameId);
      this.xrFrameId = null;
      this.xrSession = null;
    }
  }

  // Обработка выхода из VR
  exitVR() {
    this.state = {
      isPresenting: false,
      session: null,
      referenceSpace: null,
      frameRate: 0,
      supportedFrameRates: [],
      ipd: null,
      deviceName: this.state?.deviceName ?? VRDeviceNames.unknown,
      fps: null,
      renderWidth: null,
      renderHeight: null,
    };
    this.lastStateJson = JSON.stringify(this.state);
    this.notifyAll();
    this.stopXRFrameLoop();
  }
}

// Оптимизированный хук
export function useXR() {
  const { gl, camera } = useThree();
  const manager = XRStateManager.getInstance();

  const [state, setState] = useState<XRState>(() => {
    manager.init(gl);
    return manager.getState() || {
      isPresenting: false,
      session: null,
      referenceSpace: null,
      frameRate: 0,
      supportedFrameRates: [],
      ipd: null,
      deviceName: VRDeviceNames.unknown,
      fps: null,
      renderWidth: null,
      renderHeight: null,
    };
  });

  useEffect(() => {
    if (!gl.xr) return;

    manager.init(gl);

    const handleStateChange = () => {
      const newState = manager.getState();
      if (newState) {
        setState(newState);
      }
    };

    const unsubscribe = manager.subscribe(handleStateChange);

    // Отслеживаем изменения XR сессии (оптимизировано)
    let lastPresenting = gl.xr.isPresenting;

    const checkInterval = setInterval(() => {
      const currentPresenting = gl.xr?.isPresenting || false;
      if (currentPresenting !== lastPresenting) {
        lastPresenting = currentPresenting;

        if (currentPresenting) {
          manager.startXRFrameLoop();
        } else {
          manager.exitVR();
        }
      }
    }, 100);

    if (gl.xr.isPresenting) {
      manager.startXRFrameLoop();
    }

    return () => {
      unsubscribe();
      clearInterval(checkInterval);
    };
  }, [gl.xr.isPresenting]);

  return state;
}
