// app/editor/models/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const ModelPreview = dynamic(() => import('@/components/model-preview'), {
  ssr: false,
  loading: () => <div className={styles.previewLoading}>Загрузка предпросмотра...</div>,
});

interface ModelData {
  id: string;
  name: string;
  url: string;
  size: number;
  format: string;
  uploadedAt: string;
  thumbnail?: string;
  metadata?: {
    vertices?: number;
    triangles?: number;
    materials?: string[];
    animations?: string[];
  };
}

function LazyModelPreview({
  children,
}: {
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: '300px' },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }}>{visible ? children : null}</div>;
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/models');
      const data = await response.json();

      if (response.ok) {
        setModels(data.models);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setModels(prev => [...prev, data.model]);
        setSelectedModel(data.model);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to upload model');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (model: ModelData) => {
    if (!confirm(`Удалить модель "${model.name}"?`)) return;

    try {
      const response = await fetch(`/api/models/${model.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setModels(prev => prev.filter(m => m.id !== model.id));
        if (selectedModel?.id === model.id) {
          setSelectedModel(null);
        }
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete model');
    }
  };

  const handleModelLoad = useCallback((modelId: string, info: any) => {
    setModels(prev => prev.map(m =>
      m.id === modelId ? { ...m, metadata: info } : m
    ));

    if (selectedModel?.id === modelId) {
      setSelectedModel(prev => prev ? { ...prev, metadata: info } : null);
    }
  }, [selectedModel?.id]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num: number): string => {
    if (num > 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num > 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>3D Модели</h1>
          <p className={styles.subtitle}>
            Загружайте и управляйте 3D моделями в форматах GLTF, GLB, FBX, OBJ
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
              title="Сетка"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="7" height="7" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" strokeWidth="2" />
              </svg>
            </button>
            <button
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              title="Список"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2" />
              </svg>
            </button>
          </div>
          <button
            className={styles.uploadButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 4v16m8-8H4" strokeWidth="2" />
            </svg>
            {uploading ? 'Загрузка...' : 'Загрузить модель'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gltf,.glb,.fbx,.obj"
            onChange={handleFileSelect}
            className={styles.fileInput}
          />
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" strokeWidth="2" />
          </svg>
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className={styles.content}>
        <div className={`${styles.modelsContainer} ${styles[viewMode]}`}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Загрузка моделей...</p>
            </div>
          ) : models.length === 0 ? (
            <div className={styles.empty}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2L2 7v10l10 5 10-5V7l-10-5z" strokeWidth="2" />
                <path d="M2 7l10 5 10-5M12 22V12" strokeWidth="2" />
              </svg>
              <h3>Нет моделей</h3>
              <p>Загрузите первую 3D модель, чтобы начать работу</p>
            </div>
          ) : viewMode === 'grid' ? (
            models.map(model => (
              <div
                key={model.id}
                className={`${styles.modelCard} ${selectedModel?.id === model.id ? styles.selected : ''
                  }`}
                onClick={() => setSelectedModel(model)}
              >
                <div className={styles.modelPreview}>
                  {model.thumbnail ? (
                    <img src={model.thumbnail} alt={model.name} />
                  ) : (
                    <div className={styles.previewPlaceholder}>
                      <LazyModelPreview>
                        <ModelPreview
                          url={model.url}
                          format={model.format}
                          autoRotate={false}
                          onLoad={(info) => handleModelLoad(model.id, info)}
                        />
                      </LazyModelPreview>
                    </div>
                  )}
                  <span className={styles.formatBadge}>{model.format.toUpperCase()}</span>
                </div>
                <div className={styles.modelInfo}>
                  <h4 className={styles.modelName} title={model.name}>
                    {model.name}
                  </h4>
                  <div className={styles.modelMeta}>
                    <span>{formatSize(model.size)}</span>
                    {model.metadata?.triangles && (
                      <span>{formatNumber(model.metadata.triangles)} треуг.</span>
                    )}
                  </div>
                  <div className={styles.modelDate}>
                    {formatDate(model.uploadedAt)}
                  </div>
                </div>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(model);
                  }}
                  title="Удалить"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            ))
          ) : (
            models.map(model => (
              <div
                key={model.id}
                className={`${styles.listItem} ${selectedModel?.id === model.id ? styles.selected : ''
                  }`}
                onClick={() => setSelectedModel(model)}
              >
                <div className={styles.listPreview}>
                  {model.thumbnail ? (
                    <img src={model.thumbnail} alt={model.name} />
                  ) : (
                    <div className={styles.listPreviewPlaceholder}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2L2 7v10l10 5 10-5V7l-10-5z" strokeWidth="2" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className={styles.listInfo}>
                  <h4 className={styles.listName}>{model.name}</h4>
                  <div className={styles.listMeta}>
                    <span className={styles.listFormat}>{model.format.toUpperCase()}</span>
                    <span>{formatSize(model.size)}</span>
                    {model.metadata?.triangles && (
                      <span>{formatNumber(model.metadata.triangles)} треуг.</span>
                    )}
                    <span>{formatDate(model.uploadedAt)}</span>
                  </div>
                </div>
                <button
                  className={styles.listDeleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(model);
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

        {selectedModel && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <h3>Предпросмотр модели</h3>
              <div className={styles.detailActions}>
                <button
                  className={`${styles.rotateButton} ${autoRotate ? styles.active : ''}`}
                  onClick={() => setAutoRotate(!autoRotate)}
                  title="Автоповорот"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M23 4v6h-6M1 20v-6h6" strokeWidth="2" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeWidth="2" />
                  </svg>
                </button>
                <button className={styles.closeButton} onClick={() => setSelectedModel(null)}>
                  ×
                </button>
              </div>
            </div>
            <div className={styles.detailPreview}>
              <ModelPreview
                key={selectedModel.id}
                url={selectedModel.url}
                format={selectedModel.format}
                autoRotate={autoRotate}
                onLoad={(info) => handleModelLoad(selectedModel.id, info)}
              />
            </div>
            <div className={styles.detailInfo}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Имя файла:</span>
                <span className={styles.detailValue}>{selectedModel.name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Формат:</span>
                <span className={styles.detailValue}>{selectedModel.format.toUpperCase()}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Размер:</span>
                <span className={styles.detailValue}>{formatSize(selectedModel.size)}</span>
              </div>
              {selectedModel.metadata?.vertices && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Вершин:</span>
                  <span className={styles.detailValue}>{formatNumber(selectedModel.metadata.vertices)}</span>
                </div>
              )}
              {selectedModel.metadata?.triangles && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Треугольников:</span>
                  <span className={styles.detailValue}>{formatNumber(selectedModel.metadata.triangles)}</span>
                </div>
              )}
              {selectedModel.metadata?.materials && selectedModel.metadata.materials.length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Материалы:</span>
                  <span className={styles.detailValue}>{selectedModel.metadata.materials.join(', ')}</span>
                </div>
              )}
              {selectedModel.metadata?.animations && selectedModel.metadata.animations.length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Анимации:</span>
                  <span className={styles.detailValue}>{selectedModel.metadata.animations.join(', ')}</span>
                </div>
              )}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Загружена:</span>
                <span className={styles.detailValue}>{formatDate(selectedModel.uploadedAt)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>URL:</span>
                <span className={styles.detailValue}>
                  <input
                    type="text"
                    value={selectedModel.url}
                    readOnly
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
