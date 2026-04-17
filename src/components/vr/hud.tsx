import {useFrame} from "@react-three/fiber";
import {useState} from "react";
import {Text3D} from "@react-three/drei";
import {WebRTCStats} from "@/app/_lib/common/types";
import {useStore} from "@/app/_lib/common/store";
import {GroupLayered} from "@/components/three-js/group-layered";
import {useXR} from "@/app/_lib/xr/xr-tracking/hooks/useXR";
import {GroupHeadTracked} from "@/components/vr/xr/group-head-tracked";
import {PlaneRoundedGeometry} from "@/components/three-js/plane-rounded-geometry";
import {LAYERS} from "@/app/constants";


type BatteryHUD = {
  wsUrl?: string;
  initialLevel?: number;
  batteryLevel: number | null;
  webrtcStats?: WebRTCStats;
};

function getBatteryColor(level: number | null, time: number): string {
  if (level === null) {
    return "#ff1111";
  } else if (level >= 50) {
    return "#029304";
  } else if (level > 10) {
    return "#f9ff00";
  } else {
    // мигает белым-красным
    return Math.sin(time * 6) > 0 ? "#ffffff" : "#ff1111";
  }
}

export function HUD({batteryLevel, webrtcStats}: BatteryHUD) {
  const [batteryTextColor, setBatteryTextColor] = useState<string>('');
  const activeSceneLayers = useStore((s) => s.activeSceneLayers);

  const isDebugEnabled = activeSceneLayers.includes(LAYERS.debug);

  const {isPresenting, ipd, frameRate, supportedFrameRates, renderHeight, renderWidth, deviceName} = useXR();

  const batteryPercent = batteryLevel !== null ? Math.round(batteryLevel) : null;

  useFrame(() => {
    setBatteryTextColor(getBatteryColor(batteryLevel, performance.now() / 1000));
  });

  return (
    <GroupLayered layers={LAYERS.hud}>
      <GroupHeadTracked distance={200}>
        {/*Левая сторона HUD*/}
        {(isDebugEnabled && <group
          position={[-100, 0, 0]}
          rotation={[0, 1, 0]}
        >
          {/*Подложка под текст*/}
          <mesh>
            <PlaneRoundedGeometry width={70} height={55} roundness={3}/>
            <meshBasicMaterial
              color="#00ff00"
              transparent={true}
              opacity={0.02}
              depthTest={false}
            />
          </mesh>
          {/*Текст*/}
          <Text3D
            font={"/fonts/font.json"}
            position={[-27, 21, 0]}
            size={4}
            height={0.01}
          >
            {`Packets lost: ${webrtcStats?.packetsLost ?? "-"}
Frames dropped: ${webrtcStats?.framesDropped ?? "-"}
Freeze count: ${webrtcStats?.freezeCount?.toFixed(2) ?? "-"}\n\n`}

            {`isPresenting: ${isPresenting}
ipd: ${ipd}
frameRate: ${frameRate}
supportedFrameRates: ${supportedFrameRates}
renderWidth: ${renderWidth}
renderHeight: ${renderHeight}
deviceName: ${deviceName}`}
            <meshStandardMaterial
              emissive="#ffffff"
              emissiveIntensity={1}
              depthTest={false}
            />
          </Text3D>
        </group>)}


        {/*Правая сторона HUD*/}
        <group
          position={[120, 0, 0]}
          rotation={[0, -1, 0]}
        >
          <mesh>
            <PlaneRoundedGeometry width={25} height={15} roundness={3}/>
            <meshBasicMaterial
              color="#ff0000"
              transparent={true}
              opacity={0.02}
              depthTest={false}
            />
          </mesh>
          {/*Текст*/}
          <Text3D
            font={"/fonts/font.json"}
            position={[-8, 2, 0]}
            size={4}
            height={0.01}
          >
            BATTERY
            {'\n'}
            {batteryPercent === null ? '???' : batteryPercent + "%"}

            <meshStandardMaterial
              emissive={batteryTextColor}
              emissiveIntensity={1}
              depthTest={false}
            />
          </Text3D>
        </group>

      </GroupHeadTracked>
    </GroupLayered>
  );
}
