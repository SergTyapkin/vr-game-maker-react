// lib/hooks/useTextures.ts
import { useState, useEffect, useCallback } from 'react';

interface TextureData {
  id: string;
  name: string;
  url: string;
  size: number;
  format: string;
  uploadedAt: string;
}

export function useTextures() {
  const [textures, setTextures] = useState<TextureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTextures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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

  const uploadTexture = useCallback(async (file: File) => {
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
        return { success: true, texture: data.texture };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to upload texture' };
    }
  }, []);

  const deleteTexture = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/textures/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTextures(prev => prev.filter(t => t.id !== id));
        return { success: true };
      } else {
        const data = await response.json();
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to delete texture' };
    }
  }, []);

  useEffect(() => {
    loadTextures();
  }, [loadTextures]);

  return {
    textures,
    loading,
    error,
    loadTextures,
    uploadTexture,
    deleteTexture,
  };
}
