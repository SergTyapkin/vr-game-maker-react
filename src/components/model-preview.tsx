// components/editor/ModelPreview.tsx
'use client';

import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useFBX, Environment, Grid, Bounds, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import * as THREEStdLib from 'three-stdlib';

interface ModelPreviewProps {
  url: string;
  format: string;
  autoRotate?: boolean;
  backgroundColor?: string;
  onLoad?: (info: { vertices: number; triangles: number; materials: string[]; animations: string[] }) => void;
}

// Компонент для отображения OBJ моделей
function OBJModel({ url, onLoad }: { url: string; onLoad?: (info: any) => void }) {
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = new THREEStdLib.OBJLoader();

    loader.load(
      url,
      (loadedObj) => {
        setObj(loadedObj);
        setLoading(false);

        // Собираем информацию о модели
        let vertices = 0;
        let triangles = 0;
        const materials: string[] = [];

        loadedObj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const geom = child.geometry;
            if (geom.attributes.position) {
              vertices += geom.attributes.position.count;
            }
            if (geom.index) {
              triangles += geom.index.count / 3;
            } else if (geom.attributes.position) {
              triangles += geom.attributes.position.count / 3;
            }

            if (child.material) {
              const mat = child.material as THREE.Material;
              if (mat.name && !materials.includes(mat.name)) {
                materials.push(mat.name);
              }
            }
          }
        });

        onLoad?.({
          vertices: Math.round(vertices),
          triangles: Math.round(triangles),
          materials,
          animations: [],
        });
      },
      undefined,
      (err) => {
        console.error('Error loading OBJ:', err);
        setError('Failed to load OBJ model');
        setLoading(false);
      }
    );
  }, [url, onLoad]);

  if (loading) return <Loader />;
  if (error) return <ErrorFallback error={error} />;
  if (!obj) return null;

  return <primitive object={obj} />;
}

// Компонент для отображения GLTF/GLB моделей
function GLTFModel({ url, onLoad }: { url: string; onLoad?: (info: any) => void }) {
  const { scene, animations } = useGLTF(url);
  const { scene: originalScene } = useGLTF(url);

  useEffect(() => {
    if (scene) {
      let vertices = 0;
      let triangles = 0;
      const materials: string[] = [];

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geom = child.geometry;
          if (geom.attributes.position) {
            vertices += geom.attributes.position.count;
          }
          if (geom.index) {
            triangles += geom.index.count / 3;
          } else if (geom.attributes.position) {
            triangles += geom.attributes.position.count / 3;
          }

          if (child.material) {
            const mat = child.material as THREE.Material;
            if (mat.name && !materials.includes(mat.name)) {
              materials.push(mat.name);
            }
          }
        }
      });

      onLoad?.({
        vertices: Math.round(vertices),
        triangles: Math.round(triangles),
        materials,
        animations: animations.map(a => a.name || 'Unnamed'),
      });
    }
  }, [scene, animations, onLoad]);

  // Клонируем сцену для предпросмотра
  const clonedScene = useRef(originalScene.clone()).current;

  return <primitive object={clonedScene} />;
}

// Компонент для отображения FBX моделей
function FBXModel({ url, onLoad }: { url: string; onLoad?: (info: any) => void }) {
  const fbx = useFBX(url);

  useEffect(() => {
    if (fbx) {
      let vertices = 0;
      let triangles = 0;
      const materials: string[] = [];

      fbx.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geom = child.geometry;
          if (geom.attributes.position) {
            vertices += geom.attributes.position.count;
          }
          if (geom.index) {
            triangles += geom.index.count / 3;
          } else if (geom.attributes.position) {
            triangles += geom.attributes.position.count / 3;
          }

          if (child.material) {
            const mat = child.material as THREE.Material;
            if (mat.name && !materials.includes(mat.name)) {
              materials.push(mat.name);
            }
          }
        }
      });

      onLoad?.({
        vertices: Math.round(vertices),
        triangles: Math.round(triangles),
        materials,
        animations: [],
      });
    }
  }, [fbx, onLoad]);

  return <primitive object={fbx} />;
}

// Автоматическое вращение камеры
function AutoRotate({ enabled = true, speed = 0.5 }: { enabled?: boolean; speed?: number }) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useFrame((state, delta) => {
    if (controlsRef.current && enabled) {
      controlsRef.current.target.set(0, 0, 0);
      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta * speed * 0.1);
      camera.lookAt(0, 0, 0);
      controlsRef.current.update();
    }
  });

  return <OrbitControls ref={controlsRef} enableZoom enablePan={false} />;
}

// Загрузчик
function Loader() {
  const { progress } = useProgress();
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#9333ea" wireframe />
      <Html center>
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div>Загрузка...</div>
          <div>{progress.toFixed(0)}%</div>
        </div>
      </Html>
    </mesh>
  );
}

// Ошибка загрузки
function ErrorFallback({ error }: { error: string }) {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ef4444" wireframe />
      <Html center>
        <div style={{ color: '#ef4444', textAlign: 'center' }}>
          <div>Ошибка загрузки</div>
          <div style={{ fontSize: '0.75rem' }}>{error}</div>
        </div>
      </Html>
    </mesh>
  );
}

import { Html } from '@react-three/drei';

// Основной компонент предпросмотра
export default function ModelPreview({
                                       url,
                                       format,
                                       autoRotate = true,
                                       backgroundColor = 'transparent',
                                       onLoad,
                                     }: ModelPreviewProps) {
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([3, 2, 4]);

  const renderModel = () => {
    switch (format.toLowerCase()) {
      case 'gltf':
      case 'glb':
        return <GLTFModel url={url} onLoad={onLoad} />;
      case 'fbx':
        return <FBXModel url={url} onLoad={onLoad} />;
      case 'obj':
        return <OBJModel url={url} onLoad={onLoad} />;
      default:
        return null;
    }
  };

  return (
    <Canvas
      camera={{ position: cameraPosition, fov: 50 }}
      gl={{
        antialias: true,
        alpha: backgroundColor === 'transparent',
        preserveDrawingBuffer: true,
      }}
      style={{ background: backgroundColor }}
    >
      <Suspense fallback={<Loader />}>
        <Bounds fit clip observe margin={1.2}>
          {renderModel()}
        </Bounds>

        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Grid
          renderOrder={-1}
          position={[0, -1, 0]}
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.5}
          sectionSize={2}
          sectionThickness={1}
          fadeDistance={30}
          cellColor="#4a4a6a"
          sectionColor="#9333ea"
        />

        <Environment preset="city" />

        <AutoRotate enabled={autoRotate} speed={0.3} />
      </Suspense>
    </Canvas>
  );
}
