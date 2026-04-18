// app/editor/textures/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './page.module.css';

interface TextureData {
  id: string;
  name: string;
  url: string;
  size: number;
  format: string;
  uploadedAt: string;
}

export default function TexturesPage() {
  const [textures, setTextures] = useState<TextureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedTexture, setSelectedTexture] = useState<TextureData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загрузка списка текстур
  const loadTextures = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/textures');
      const data = await response.json();

      if (response.ok) {
        setTextures(data.textures);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load textures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTextures();
  }, [loadTextures]);

  // Загрузка новой текстуры
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/textures', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setTextures(prev => [...prev, data.texture]);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to upload texture');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Удаление текстуры
  const handleDelete = async (texture: TextureData) => {
    if (!confirm(`Удалить текстуру "${texture.name}"?`)) return;

    try {
      const response = await fetch(`/api/textures/${texture.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTextures(prev => prev.filter(t => t.id !== texture.id));
        if (selectedTexture?.id === texture.id) {
          setSelectedTexture(null);
        }
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete texture');
    }
  };

  // Форматирование размера
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Форматирование даты
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Текстуры</h1>
          <p className={styles.subtitle}>
            Загружайте и управляйте текстурами для материалов
          </p>
        </div>
        <button
          className={styles.uploadButton}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 4v16m8-8H4" strokeWidth="2" />
          </svg>
          {uploading ? 'Загрузка...' : 'Загрузить текстуру'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.bmp"
          onChange={handleFileSelect}
          className={styles.fileInput}
        />
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
        <div className={styles.grid}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Загрузка текстур...</p>
            </div>
          ) : textures.length === 0 ? (
            <div className={styles.empty}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M21 15l-5-5L7 21" strokeWidth="2" />
              </svg>
              <h3>Нет текстур</h3>
              <p>Загрузите первую текстуру, чтобы начать работу</p>
            </div>
          ) : (
            textures.map(texture => (
              <div
                key={texture.id}
                className={`${styles.textureCard} ${
                  selectedTexture?.id === texture.id ? styles.selected : ''
                }`}
                onClick={() => setSelectedTexture(texture)}
              >
                <div className={styles.texturePreview}>
                  <img src={texture.url} alt={texture.name} loading="lazy" />
                </div>
                <div className={styles.textureInfo}>
                  <h4 className={styles.textureName} title={texture.name}>
                    {texture.name}
                  </h4>
                  <div className={styles.textureMeta}>
                    <span>{texture.format.toUpperCase()}</span>
                    <span>{formatSize(texture.size)}</span>
                  </div>
                  <div className={styles.textureDate}>
                    {formatDate(texture.uploadedAt)}
                  </div>
                </div>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(texture);
                  }}
                  title="Удалить"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {selectedTexture && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <h3>Информация о текстуре</h3>
              <button onClick={() => setSelectedTexture(null)}>×</button>
            </div>
            <div className={styles.detailPreview}>
              <img src={selectedTexture.url} alt={selectedTexture.name} />
            </div>
            <div className={styles.detailInfo}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Имя файла:</span>
                <span className={styles.detailValue}>{selectedTexture.name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Формат:</span>
                <span className={styles.detailValue}>{selectedTexture.format.toUpperCase()}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Размер:</span>
                <span className={styles.detailValue}>{formatSize(selectedTexture.size)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Загружена:</span>
                <span className={styles.detailValue}>{formatDate(selectedTexture.uploadedAt)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>URL:</span>
                <span className={styles.detailValue}>
                  <input
                    type="text"
                    value={selectedTexture.url}
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
