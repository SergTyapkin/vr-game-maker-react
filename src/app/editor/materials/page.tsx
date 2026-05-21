// app/editor/materials/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Box, Plane } from '@react-three/drei';
import styles from './page.module.css';
import {useMaterials} from "@/api/materials/useMaterials";
import {useTextures} from "@/api/textures/useTextures";

// Типы материалов и их параметры
interface StandardMaterialProperties {
  color: string;
  emissive: string;
  roughness: number;
  metalness: number;
  transparent: boolean;
  opacity: number;
  wireframe: boolean;
  map: string;
  normalMap: string;
  roughnessMap: string;
  metalnessMap: string;
  aoMap: string;
  emissiveMap: string;
}

interface PhongMaterialProperties {
  color: string;
  emissive: string;
  specular: string;
  shininess: number;
  transparent: boolean;
  opacity: number;
  wireframe: boolean;
  map: string;
  specularMap: string;
  normalMap: string;
}

interface BasicMaterialProperties {
  color: string;
  wireframe: boolean;
  map: string;
  transparent: boolean;
  opacity: number;
}

interface ShaderMaterialProperties {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, any>;
  wireframe: boolean;
  transparent: boolean;
  opacity: number;
}

type MaterialProperties =
  | StandardMaterialProperties
  | PhongMaterialProperties
  | BasicMaterialProperties
  | ShaderMaterialProperties;

interface MaterialFormData {
  name: string;
  type: 'standard' | 'phong' | 'basic' | 'shader';
  properties: MaterialProperties;
  previewShape: 'sphere' | 'cube' | 'plane';
}

// Значения по умолчанию для каждого типа
const getDefaultProperties = (type: MaterialFormData['type']): MaterialProperties => {
  switch (type) {
    case 'standard':
      return {
        color: '#ffffff',
        emissive: '#000000',
        roughness: 0.5,
        metalness: 0,
        transparent: false,
        opacity: 1,
        wireframe: false,
        map: '',
        normalMap: '',
        roughnessMap: '',
        metalnessMap: '',
        aoMap: '',
        emissiveMap: '',
      };
    case 'phong':
      return {
        color: '#ffffff',
        emissive: '#000000',
        specular: '#333333',
        shininess: 30,
        transparent: false,
        opacity: 1,
        wireframe: false,
        map: '',
        specularMap: '',
        normalMap: '',
      };
    case 'basic':
      return {
        color: '#ffffff',
        wireframe: false,
        map: '',
        transparent: false,
        opacity: 1,
      };
    case 'shader':
      return {
        vertexShader: `varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        fragmentShader: `uniform vec3 color;
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  vec3 finalColor = color * (0.5 + 0.5 * diff);
  
  // Добавляем анимацию по времени
  finalColor += sin(vUv.x * 10.0 + time) * 0.1;
  
  gl_FragColor = vec4(finalColor, 1.0);
}`,
        uniforms: {
          color: { value: '#ffffff' },
          time: { value: 0 },
        },
        wireframe: false,
        transparent: false,
        opacity: 1,
      };
  }
};

const defaultFormData: MaterialFormData = {
  name: '',
  type: 'standard',
  properties: getDefaultProperties('standard'),
  previewShape: 'sphere',
};

// Компонент для 3D превью
function MaterialPreview({
                           properties,
                           type,
                           shape,
                           textures,
                         }: {
  properties: MaterialProperties;
  type: MaterialFormData['type'];
  shape: 'sphere' | 'cube' | 'plane';
  textures: any[];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.Material>(null);

  // Загружаем текстуры
  const textureMaps = useRef<Record<string, THREE.Texture | null>>({});

  useEffect(() => {
    const loader = new THREE.TextureLoader();

    // Загружаем все текстуры из properties
    Object.entries(properties).forEach(([key, value]) => {
      if (key.endsWith('Map') && typeof value === 'string' && value) {
        loader.load(value, (texture) => {
          textureMaps.current[key] = texture;
        });
      }
    });
  }, [properties, textures]);

  // Анимация для шейдера
  useFrame((state) => {
    if (type === 'shader' && materialRef.current) {
      const material = materialRef.current as THREE.ShaderMaterial;
      if (material.uniforms.time) {
        material.uniforms.time.value = state.clock.getElapsedTime();
      }
    }
  });

  // Создаем материал на основе типа
  const getMaterial = () => {
    const commonProps = {
      wireframe: 'wireframe' in properties ? properties.wireframe : false,
      transparent: 'transparent' in properties ? properties.transparent : false,
      opacity: 'opacity' in properties ? properties.opacity : 1,
    };

    switch (type) {
      case 'standard': {
        const props = properties as StandardMaterialProperties;
        const material = new THREE.MeshStandardMaterial({
          ...commonProps,
          color: props.color,
          emissive: props.emissive,
          roughness: props.roughness,
          metalness: props.metalness,
        });

        // Применяем текстуры
        if (textureMaps.current.map) material.map = textureMaps.current.map;
        if (textureMaps.current.normalMap) material.normalMap = textureMaps.current.normalMap;
        if (textureMaps.current.roughnessMap) material.roughnessMap = textureMaps.current.roughnessMap;
        if (textureMaps.current.metalnessMap) material.metalnessMap = textureMaps.current.metalnessMap;

        return material;
      }

      case 'phong': {
        const props = properties as PhongMaterialProperties;
        return new THREE.MeshPhongMaterial({
          ...commonProps,
          color: props.color,
          emissive: props.emissive,
          specular: props.specular,
          shininess: props.shininess,
          map: textureMaps.current.map,
        });
      }

      case 'basic': {
        const props = properties as BasicMaterialProperties;
        return new THREE.MeshBasicMaterial({
          ...commonProps,
          color: props.color,
          map: textureMaps.current.map,
        });
      }

      case 'shader': {
        const props = properties as ShaderMaterialProperties;
        const uniforms: Record<string, any> = {};

        Object.entries(props.uniforms).forEach(([key, value]) => {
          if (key === 'color') {
            uniforms[key] = { value: new THREE.Color(value.value) };
          } else {
            uniforms[key] = value;
          }
        });

        return new THREE.ShaderMaterial({
          ...commonProps,
          vertexShader: props.vertexShader,
          fragmentShader: props.fragmentShader,
          uniforms,
        });
      }
    }
  };

  const material = getMaterial();
  materialRef.current = material;

  const ShapeComponent = shape === 'sphere' ? Sphere : shape === 'cube' ? Box : Plane;
  const shapeProps = shape === 'plane' ? { args: [3, 3] as [number, number] } : { args: [1.5] as [number] };

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, 5, -10]} intensity={0.5} />
      <ShapeComponent ref={meshRef} {...shapeProps}>
        <primitive object={material} attach="material" />
      </ShapeComponent>
      <OrbitControls enableZoom={true} enablePan={false} />
    </>
  );
}

export default function MaterialsPage() {
  const { materials, loading, error, createMaterial, updateMaterial, deleteMaterial } = useMaterials();
  const { textures } = useTextures();

  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<MaterialFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);

  const handleCreate = () => {
    setSelectedMaterial(null);
    setFormData(defaultFormData);
    setIsCreating(true);
  };

  const handleEdit = (id: string) => {
    const material = materials.find(m => m.id === id);
    if (material) {
      setSelectedMaterial(id);

      // Объединяем с дефолтными значениями для данного типа
      const defaultProps = getDefaultProperties(material.type);
      const mergedProperties = {
        ...defaultProps,
        ...material.properties,
      };

      setFormData({
        name: material.name,
        type: material.type,
        properties: mergedProperties,
        previewShape: 'sphere',
      });
      setIsCreating(false);
    }
  };

  const handleTypeChange = (type: MaterialFormData['type']) => {
    setFormData(prev => ({
      ...prev,
      type,
      properties: getDefaultProperties(type),
    }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert('Введите название материала');
      return;
    }

    setSaving(true);

    try {
      // Очищаем properties от undefined и null
      const cleanProperties = Object.fromEntries(
        Object.entries(formData.properties).filter(([_, v]) => v !== undefined && v !== null)
      );

      if (isCreating) {
        const result = await createMaterial(formData.name, formData.type, cleanProperties);
        if (result.success) {
          setIsCreating(false);
          setFormData(defaultFormData);
        } else {
          alert('Ошибка создания материала: ' + result.error);
        }
      } else if (selectedMaterial) {
        const result = await updateMaterial(selectedMaterial, {
          name: formData.name,
          properties: cleanProperties,
        });
        if (result.success) {
          setSelectedMaterial(null);
        } else {
          alert('Ошибка обновления материала: ' + result.error);
        }
      }
    } catch (err) {
      alert('Ошибка сохранения материала');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить материал?')) {
      const result = await deleteMaterial(id);
      if (result.success && selectedMaterial === id) {
        setSelectedMaterial(null);
      } else if (!result.success) {
        alert('Ошибка удаления: ' + result.error);
      }
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setSelectedMaterial(null);
    setFormData(defaultFormData);
  };

  const updateProperty = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: value,
      } as MaterialProperties,
    }));
  };

  const updateShaderUniform = (key: string, value: any) => {
    setFormData(prev => {
      const props = prev.properties as ShaderMaterialProperties;
      return {
        ...prev,
        properties: {
          ...props,
          uniforms: {
            ...props.uniforms,
            [key]: { value },
          },
        },
      };
    });
  };

  // Рендер полей в зависимости от типа материала
  const renderPropertiesFields = () => {
    const props = formData.properties;

    switch (formData.type) {
      case 'standard':
        return (
          <>
            <div className={styles.formGroup}>
              <label>Цвет</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={(props as StandardMaterialProperties).color}
                  onChange={(e) => updateProperty('color', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Свечение</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={(props as StandardMaterialProperties).emissive}
                  onChange={(e) => updateProperty('emissive', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Шероховатость: {(props as StandardMaterialProperties).roughness}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={(props as StandardMaterialProperties).roughness}
                onChange={(e) => updateProperty('roughness', parseFloat(e.target.value))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Металличность: {(props as StandardMaterialProperties).metalness}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={(props as StandardMaterialProperties).metalness}
                onChange={(e) => updateProperty('metalness', parseFloat(e.target.value))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Основная текстура</label>
              <select
                value={(props as StandardMaterialProperties).map}
                onChange={(e) => updateProperty('map', e.target.value)}
              >
                <option value="">Нет</option>
                {textures.map(t => (
                  <option key={t.id} value={t.url}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Карта нормалей</label>
              <select
                value={(props as StandardMaterialProperties).normalMap}
                onChange={(e) => updateProperty('normalMap', e.target.value)}
              >
                <option value="">Нет</option>
                {textures.map(t => (
                  <option key={t.id} value={t.url}>{t.name}</option>
                ))}
              </select>
            </div>
          </>
        );

      case 'phong':
        return (
          <>
            <div className={styles.formGroup}>
              <label>Цвет</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={(props as PhongMaterialProperties).color}
                  onChange={(e) => updateProperty('color', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Свечение</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={(props as PhongMaterialProperties).emissive}
                  onChange={(e) => updateProperty('emissive', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Отражение (Specular)</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={(props as PhongMaterialProperties).specular}
                  onChange={(e) => updateProperty('specular', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Блеск: {(props as PhongMaterialProperties).shininess}</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={(props as PhongMaterialProperties).shininess}
                onChange={(e) => updateProperty('shininess', parseFloat(e.target.value))}
              />
            </div>
          </>
        );

      case 'basic':
        return (
          <>
            <div className={styles.formGroup}>
              <label>Цвет</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={(props as BasicMaterialProperties).color}
                  onChange={(e) => updateProperty('color', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Основная текстура</label>
              <select
                value={(props as BasicMaterialProperties).map}
                onChange={(e) => updateProperty('map', e.target.value)}
              >
                <option value="">Нет</option>
                {textures.map(t => (
                  <option key={t.id} value={t.url}>{t.name}</option>
                ))}
              </select>
            </div>
          </>
        );

      case 'shader':
        const shaderProps = props as ShaderMaterialProperties;
        return (
          <>
            <div className={styles.formGroup}>
              <label>Vertex Shader</label>
              <textarea
                className={styles.shaderCode}
                value={shaderProps.vertexShader}
                onChange={(e) => updateProperty('vertexShader', e.target.value)}
                rows={8}
                spellCheck={false}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Fragment Shader</label>
              <textarea
                className={styles.shaderCode}
                value={shaderProps.fragmentShader}
                onChange={(e) => updateProperty('fragmentShader', e.target.value)}
                rows={10}
                spellCheck={false}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Цвет (uniform)</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  value={shaderProps.uniforms.color?.value || '#ffffff'}
                  onChange={(e) => updateShaderUniform('color', e.target.value)}
                />
              </div>
            </div>
          </>
        );
    }
  };

  // Общие поля для всех типов
  const renderCommonFields = () => (
    <>
      <div className={styles.formGroup}>
        <label>
          <input
            type="checkbox"
            checked={formData.properties.wireframe || false}
            onChange={(e) => updateProperty('wireframe', e.target.checked)}
          />
          Wireframe
        </label>
      </div>

      <div className={styles.formGroup}>
        <label>
          <input
            type="checkbox"
            checked={formData.properties.transparent || false}
            onChange={(e) => updateProperty('transparent', e.target.checked)}
          />
          Прозрачность
        </label>
      </div>

      {formData.properties.transparent && (
        <div className={styles.formGroup}>
          <label>Непрозрачность: {formData.properties.opacity || 1}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={formData.properties.opacity || 1}
            onChange={(e) => updateProperty('opacity', parseFloat(e.target.value))}
          />
        </div>
      )}
    </>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Материалы</h1>
          <p className={styles.subtitle}>
            Создавайте и настраивайте материалы для объектов
          </p>
        </div>
        <button className={styles.createButton} onClick={handleCreate}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 4v16m8-8H4" strokeWidth="2" />
          </svg>
          Создать материал
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.materialsList}>
          {loading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : materials.length === 0 ? (
            <div className={styles.empty}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5z" strokeWidth="2" />
                <path d="M2 17l10 5 10-5" strokeWidth="2" />
                <path d="M2 12l10 5 10-5" strokeWidth="2" />
              </svg>
              <p>Нет материалов</p>
            </div>
          ) : (
            materials.map(material => (
              <div
                key={material.id}
                className={`${styles.materialItem} ${
                  selectedMaterial === material.id ? styles.selected : ''
                }`}
                onClick={() => handleEdit(material.id)}
              >
                <div
                  className={styles.materialPreview}
                  style={{ backgroundColor: material.properties.color || '#ffffff' }}
                />
                <div className={styles.materialInfo}>
                  <h4>{material.name}</h4>
                  <span className={styles.materialType}>{material.type}</span>
                </div>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(material.id);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {(isCreating || selectedMaterial) && (
          <div className={styles.editor}>
            <div className={styles.editorHeader}>
              <h3>{isCreating ? 'Новый материал' : 'Редактирование'}</h3>
              <button className={styles.closeButton} onClick={handleCancel}>×</button>
            </div>

            <div className={styles.editorContent}>
              <div className={styles.formGroup}>
                <label>Название</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Например: Металл, Дерево..."
                />
              </div>

              <div className={styles.formGroup}>
                <label>Тип материала</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value as MaterialFormData['type'])}
                >
                  <option value="standard">Standard (PBR)</option>
                  <option value="phong">Phong</option>
                  <option value="basic">Basic</option>
                  <option value="shader">Custom Shader</option>
                </select>
              </div>

              {renderPropertiesFields()}
              {renderCommonFields()}

              {/* 3D Preview */}
              <div className={styles.previewSection}>
                <h4 className={styles.previewTitle}>Предпросмотр</h4>
                <div className={styles.previewControls}>
                  <button
                    className={`${styles.shapeButton} ${formData.previewShape === 'sphere' ? styles.active : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, previewShape: 'sphere' }))}
                  >
                    ⚫ Сфера
                  </button>
                  <button
                    className={`${styles.shapeButton} ${formData.previewShape === 'cube' ? styles.active : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, previewShape: 'cube' }))}
                  >
                    🧊 Куб
                  </button>
                  <button
                    className={`${styles.shapeButton} ${formData.previewShape === 'plane' ? styles.active : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, previewShape: 'plane' }))}
                  >
                    ⬜ Плоскость
                  </button>
                </div>
                <div className={styles.previewCanvas}>
                  <Canvas camera={{ position: [2, 2, 3], fov: 50 }}>
                    <MaterialPreview
                      properties={formData.properties}
                      type={formData.type}
                      shape={formData.previewShape}
                      textures={textures}
                    />
                  </Canvas>
                </div>
              </div>
            </div>

            <div className={styles.editorFooter}>
              <button className={styles.cancelButton} onClick={handleCancel}>
                Отмена
              </button>
              <button
                className={styles.saveButton}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Сохранение...' : (isCreating ? 'Создать' : 'Сохранить')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
