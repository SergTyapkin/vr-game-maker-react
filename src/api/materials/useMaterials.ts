// lib/hooks/useMaterials.ts
import { useState, useEffect, useCallback } from 'react';

interface MaterialData {
  id: string;
  name: string;
  type: 'standard' | 'phong' | 'basic' | 'shader';
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export function useMaterials() {
  const [materials, setMaterials] = useState<MaterialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/materials');
      const data = await response.json();

      if (response.ok) {
        setMaterials(data.materials);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, []);

  const createMaterial = useCallback(async (name: string, type: string = 'standard', properties: any = {}) => {
    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, properties }),
      });

      const data = await response.json();

      if (response.ok) {
        setMaterials(prev => [...prev, data.material]);
        return { success: true, material: data.material };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to create material' };
    }
  }, []);

  const updateMaterial = useCallback(async (id: string, updates: Partial<MaterialData>) => {
    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok) {
        setMaterials(prev => prev.map(m => m.id === id ? data.material : m));
        return { success: true, material: data.material };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to update material' };
    }
  }, []);

  const deleteMaterial = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMaterials(prev => prev.filter(m => m.id !== id));
        return { success: true };
      } else {
        const data = await response.json();
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to delete material' };
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  return {
    materials,
    loading,
    error,
    loadMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
  };
}
