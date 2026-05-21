import {LAYERS} from "@/app/constants";
import { GroupLayered } from "../three-js/group-layered";
import { GroupHeadTracked } from "./group-head-tracked";



export function HUD({}) {

  return (
    <GroupLayered layers={LAYERS.hud}>
      <GroupHeadTracked distance={200}>
        {/*Левая сторона HUD*/}
        <group
          position={[-100, 0, 0]}
          rotation={[0, 1, 0]}
        >
        </group>


        {/*Правая сторона HUD*/}
        <group
          position={[120, 0, 0]}
          rotation={[0, -1, 0]}
        >
        </group>
      </GroupHeadTracked>
    </GroupLayered>
  );
}
