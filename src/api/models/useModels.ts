// lib/hooks/useModels.ts
import { useState, useEffect, useCallback } from 'react';

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

export function useModels() {
  const [models, setModels] = useState<ModelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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
  }, []);

  const uploadModel = useCallback(async (file: File) => {
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
        return { success: true, model: data.model };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to upload model' };
    }
  }, []);

  const deleteModel = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/models/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setModels(prev => prev.filter(m => m.id !== id));
        return { success: true };
      } else {
        const data = await response.json();
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to delete model' };
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return {
    models,
    loading,
    error,
    loadModels,
    uploadModel,
    deleteModel,
  };
}
