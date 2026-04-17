import {useMemo} from "react";
import * as THREE from "three";

type Props = {
   width: number,
   height: number,
   roundness: number,
};

export function PlaneRoundedGeometry({width, height, roundness}: Props) {
  const shape = useMemo(() => {
    // Создаем форму для экструзии
    const shape = new THREE.Shape();

    // Рисуем скругленный прямоугольник
    // От левого нижнего угла, идем по часовой стрелке
    shape.moveTo(-width/2 + roundness, -height/2);
    shape.lineTo(width/2 - roundness, -height/2);
    shape.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + roundness);
    shape.lineTo(width/2, height/2 - roundness);
    shape.quadraticCurveTo(width/2, height/2, width/2 - roundness, height/2);
    shape.lineTo(-width/2 + roundness, height/2);
    shape.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - roundness);
    shape.lineTo(-width/2, -height/2 + roundness);
    shape.quadraticCurveTo(-width/2, -height/2, -width/2 + roundness, -height/2);

    return shape;
  }, [width, height, roundness]);

  return (
      <shapeGeometry args={[shape]} />
  );
}
