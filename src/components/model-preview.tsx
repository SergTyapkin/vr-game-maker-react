// components/editor/ModelPreview.tsx
'use client';

import { Component, Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, useFBX, Environment, Grid, Bounds, Center, useProgress, Html } from '@react-three/drei';
import * as THREE from 'three';
import * as THREEStdLib from 'three-stdlib';

interface ModelPreviewProps {
  url: string;
  format: string;
  autoRotate?: boolean;
  backgroundColor?: string;
  onLoad?: (info: { vertices: number; triangles: number; materials: string[]; animations: string[] }) => void;
}

class PreviewErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? <ErrorFallback error="Не удалось загрузить модель" /> : this.props.children;
  }
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
  }, [url]);

  if (loading) return <Loader />;
  if (error) return <ErrorFallback error={error} />;
  if (!obj) return null;

  return <primitive object={obj} />;
}

// Компонент для отображения GLTF/GLB моделей
function GLTFModel({ url, onLoad }: { url: string; onLoad?: (info: any) => void }) {
  const { scene, animations } = useGLTF(url);

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
  }, [scene, animations]);

  // Клонируем сцену для предпросмотра
  const clonedScene = useMemo(() => scene.clone(), [scene]);

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
  }, [fbx]);

  return <primitive object={fbx} />;
}

function AutoRotate({ enabled = true, speed = 0.5 }: { enabled?: boolean; speed?: number }) {
  return (
    <OrbitControls
      autoRotate={enabled}
      autoRotateSpeed={speed}
      enableDamping
      dampingFactor={0.08}
      enableZoom
      enablePan={false}
      minDistance={0.1}
    />
  );
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

// Основной компонент предпросмотра
export default function ModelPreview({
                                       url,
                                       format,
                                       autoRotate = true,
                                       backgroundColor = 'transparent',
                                       onLoad,
                                     }: ModelPreviewProps) {
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
    <PreviewErrorBoundary>
      <Canvas
        camera={{ position: [3, 2, 4], fov: 50 }}
        dpr={[1, 1.5]}
        frameloop={autoRotate ? 'always' : 'demand'}
        gl={{
          antialias: false,
          alpha: backgroundColor === 'transparent',
        }}
        style={{ background: backgroundColor }}
      >
        <Suspense fallback={<Loader />}>
          <Bounds fit clip margin={1.25}>
            <Center>
              {renderModel()}
            </Center>
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
    </PreviewErrorBoundary>
  );
}
