import { useRef, useEffect, ReactNode } from 'react';
import {Group} from "three";

interface Props {
  children: ReactNode;
  layers: number | number[];
  mode?: 'set' | 'enable' | 'disable';
  [key: string]: any; // для остальных пропсов Html
}

export function GroupLayered({ children, layers, mode = 'set', ...props }: Props) {
  const groupRef = useRef<Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    const layersArray = Array.isArray(layers) ? layers : [layers];

    // Применяем слои ко всем объектам в группе
    groupRef.current.traverse((object) => {
      layersArray.forEach(layer => {
        switch (mode) {
          case 'set':
            object.layers.set(layer);
            break;
          case 'enable':
            object.layers.enable(layer);
            break;
          case 'disable':
            object.layers.disable(layer);
            break;
        }
      });
    });
  }, [layers, mode]);

  return <group ref={groupRef} {...props}>{children}</group>;
}
