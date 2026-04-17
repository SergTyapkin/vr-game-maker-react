import {log} from "@/core/common/utils";

// Подменяем requestSession метод, чтобы VRButton, вызвав его внутри себя, вызвала его с нашими настройками
export function createXRSession(onVisibilityChangeVisible: () => unknown) {
  if (!navigator.xr?.requestSession) return;

  const originalRequestSession = navigator.xr.requestSession.bind(navigator.xr);

  navigator.xr.requestSession = async function (mode, options: XRSessionInit = {}) {
    const merged = {
      ...options,
      requiredFeatures: Array.from(new Set([...(options?.requiredFeatures ?? []), "local-floor"])),
      optionalFeatures: Array.from(new Set([...(options?.optionalFeatures ?? []), "bounded-floor", "layers", "body-tracking", "hand-tracking"])),
    } as XRSessionInit;
    const session = await originalRequestSession(mode, merged);
    log("XR session started via intercepted requestSession (hand-tracking injected)");

    session.addEventListener("inputsourceschange", (e: XRInputSourcesChangeEvent) => {
      log("inputsourceschange",
        "added:", e.added?.map((s: XRInputSource) => ({ hand: !!s.hand, mode: s.targetRayMode })),
        "removed:", e.removed?.length);
    });

    session.addEventListener("visibilitychange", async () => {
      log("XR visibility:", session.visibilityState);
      if (session.visibilityState === "visible") {
        onVisibilityChangeVisible();
      }
    });

    return session;
  };

  return originalRequestSession;
}
