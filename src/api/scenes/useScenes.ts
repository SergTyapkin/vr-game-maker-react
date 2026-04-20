// lib/hooks/useScenes.ts
import { useState, useCallback } from 'react';
import { SceneData } from '@/core/scene/types';

interface SceneListItem {
  id: string;
  name: string;
  description?: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    thumbnail?: string;
  };
}

export function useScenes() {
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScenes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/scenes');
      const data = await response.json();

      if (response.ok) {
        setScenes(data.scenes || []);
        return { success: true, scenes: data.scenes };
      } else {
        setError(data.error || 'Failed to load scenes');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Network error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const createScene = useCallback(async (name: string, description?: string) => {
    try {
      setError(null);

      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();

      if (response.ok) {
        setScenes(prev => [...prev, data.scene]);
        return { success: true, scene: data.scene };
      } else {
        setError(data.error || 'Failed to create scene');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Network error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  const loadScene = useCallback(async (sceneId: string) => {
    try {
      setError(null);

      const response = await fetch(`/api/scenes/${sceneId}`);
      const data = await response.json();

      if (response.ok) {
        return { success: true, scene: data.scene };
      } else {
        setError(data.error || 'Failed to load scene');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Network error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  const saveScene = useCallback(async (scene: SceneData) => {
    try {
      setError(null);

      const response = await fetch(`/api/scenes/${scene.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene }),
      });

      const data = await response.json();

      if (response.ok) {
        // Обновляем сцену в списке
        setScenes(prev => prev.map(s =>
          s.id === scene.id ? data.scene : s
        ));
        return { success: true, scene: data.scene };
      } else {
        setError(data.error || 'Failed to save scene');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Network error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  const deleteScene = useCallback(async (sceneId: string) => {
    try {
      setError(null);

      const response = await fetch(`/api/scenes/${sceneId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setScenes(prev => prev.filter(s => s.id !== sceneId));
        return { success: true };
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete scene');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Network error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  return {
    scenes,
    loading,
    error,
    loadScenes,
    createScene,
    loadScene,
    saveScene,
    deleteScene,
  };
}
