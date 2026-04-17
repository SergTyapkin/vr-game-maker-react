import {create} from "zustand";
import {LAYERS} from "@/app/constants";


export type State = {
  activeSceneLayers: number[];
  toggleSceneLayer: (layer: number) => void;
  isSceneLayerEnabled: (layer: number) => boolean;
  setSceneLayerState: (layer: number, state: boolean) => void;
};

export const useStore = create<State>((set, get) => ({
  activeSceneLayers: [LAYERS.default, LAYERS.left, LAYERS.right],
  toggleSceneLayer: (layer: number) => set((state) => ({
    activeSceneLayers: state.activeSceneLayers.includes(layer)
      ? state.activeSceneLayers.filter(l => l !== layer)
      : [...state.activeSceneLayers, layer]
  })),
  isSceneLayerEnabled: (layer: number) => get().activeSceneLayers.includes(layer),
  setSceneLayerState: (layer: number, val: boolean) => {
    // Включение
    if (val) {
      set((state) => ({
        activeSceneLayers: state.activeSceneLayers.includes(layer)
          ? state.activeSceneLayers
          : [...state.activeSceneLayers, layer]
      }));
      return;
    }
    // Выключение
    set((state) => ({
      activeSceneLayers: state.activeSceneLayers.filter(l => l !== layer)
    }));
  },
}));
