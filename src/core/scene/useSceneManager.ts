// lib/hooks/useSceneManager.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SceneManager, SceneUser } from '@/core/scene/SceneManager';
import { SceneData, AnySceneObject, Transform } from '@/core/scene/types';

interface UseSceneManagerOptions {
  autoConnect?: boolean;
  wsUrl?: string;
  user?: {
    id: string;
    name: string;
    sessionType: 'editor' | 'vr';
  };
}

export function useSceneManager(options: UseSceneManagerOptions = {}) {
  const sceneManager = useRef(SceneManager.getInstance()).current;

  const [currentScene, setCurrentScene] = useState<SceneData | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<SceneUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Настройка пользователя
  useEffect(() => {
    if (options.user) {
      sceneManager.setCurrentUser(options.user);
    }
  }, [options.user, sceneManager]);

  // Подключение
  useEffect(() => {
    if (options.autoConnect) {
      sceneManager.configure({
        wsUrl: options.wsUrl,
        autoReconnect: true,
      });

      setIsLoading(true);
      sceneManager.connect()
        .then(() => {
          setIsConnected(true);
          setSessionId(sceneManager.getSessionId());
        })
        .catch(setError)
        .finally(() => setIsLoading(false));
    }

    // Подписки на события
    const handleConnected = () => {
      setIsConnected(true);
      setSessionId(sceneManager.getSessionId());
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setSessionId(null);
    };

    const handleSceneLoaded = (scene: SceneData) => {
      setCurrentScene(scene);
    };

    const handleSceneSynced = (scene: SceneData) => {
      setCurrentScene(scene);
    };

    const handleUserJoined = () => {
      setRemoteUsers(sceneManager.getRemoteUsers());
    };

    const handleUserLeft = () => {
      setRemoteUsers(sceneManager.getRemoteUsers());
    };

    const handleError = (err: Error) => {
      setError(err);
    };

    const handleObjectAdded = () => {
      const scene = sceneManager.getCurrentScene();
      if (scene) setCurrentScene({ ...scene });
    };

    const handleObjectRemoved = () => {
      const scene = sceneManager.getCurrentScene();
      if (scene) setCurrentScene({ ...scene });
    };

    const handleObjectUpdated = () => {
      const scene = sceneManager.getCurrentScene();
      if (scene) setCurrentScene({ ...scene });
    };

    sceneManager.on('ws:connected', handleConnected);
    sceneManager.on('ws:disconnected', handleDisconnected);
    sceneManager.on('scene:loaded', handleSceneLoaded);
    sceneManager.on('scene:synced', handleSceneSynced);
    sceneManager.on('user:joined', handleUserJoined);
    sceneManager.on('user:left', handleUserLeft);
    sceneManager.on('scene:error', handleError);
    sceneManager.on('ws:error', handleError);
    sceneManager.on('object:added', handleObjectAdded);
    sceneManager.on('object:removed', handleObjectRemoved);
    sceneManager.on('object:updated', handleObjectUpdated);

    return () => {
      sceneManager.off('ws:connected', handleConnected);
      sceneManager.off('ws:disconnected', handleDisconnected);
      sceneManager.off('scene:loaded', handleSceneLoaded);
      sceneManager.off('scene:synced', handleSceneSynced);
      sceneManager.off('user:joined', handleUserJoined);
      sceneManager.off('user:left', handleUserLeft);
      sceneManager.off('scene:error', handleError);
      sceneManager.off('ws:error', handleError);
      sceneManager.off('object:added', handleObjectAdded);
      sceneManager.off('object:removed', handleObjectRemoved);
      sceneManager.off('object:updated', handleObjectUpdated);
    };
  }, [options.autoConnect, options.wsUrl, sceneManager]);

  // Методы для работы со сценой
  const loadScene = useCallback(async (sceneId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const scene = await sceneManager.loadScene(sceneId);
      if (scene) {
        setCurrentScene(scene);
      }
      return scene;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sceneManager]);

  const createScene = useCallback((name: string) => {
    try {
      const scene = sceneManager.createScene(name);
      setCurrentScene(scene);
      return scene;
    } catch (err) {
      setError(err as Error);
      return null;
    }
  }, [sceneManager]);

  const saveScene = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await sceneManager.saveScene();
      return success;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sceneManager]);

  // Методы для работы с объектами
  const addObject = useCallback((object: Partial<AnySceneObject>, parentId?: string) => {
    try {
      const id = sceneManager.addObject(object, parentId);
      return id;
    } catch (err) {
      setError(err as Error);
      return null;
    }
  }, [sceneManager]);

  const removeObject = useCallback((objectId: string) => {
    try {
      sceneManager.removeObject(objectId);
    } catch (err) {
      setError(err as Error);
    }
  }, [sceneManager]);

  const updateObject = useCallback((objectId: string, updates: Partial<AnySceneObject>) => {
    try {
      sceneManager.updateObject(objectId, updates);
    } catch (err) {
      setError(err as Error);
    }
  }, [sceneManager]);

  const transformObject = useCallback((objectId: string, transform: Partial<Transform>) => {
    try {
      sceneManager.transformObject(objectId, transform);
    } catch (err) {
      setError(err as Error);
    }
  }, [sceneManager]);

  // Методы для работы с сетью
  const sendControllerState = useCallback((controller: 'left' | 'right', state: {
    position: [number, number, number];
    rotation: [number, number, number];
    buttons: Record<string, boolean>;
  }) => {
    sceneManager.sendControllerState(controller, state);
  }, [sceneManager]);

  const sendSelectionUpdate = useCallback((objectId: string | null) => {
    sceneManager.sendSelectionUpdate(objectId);
  }, [sceneManager]);

  // История
  const undo = useCallback(() => {
    const success = sceneManager.undo();
    if (success) {
      const scene = sceneManager.getCurrentScene();
      if (scene) setCurrentScene({ ...scene });
    }
    return success;
  }, [sceneManager]);

  // Получение объектов
  const getObject = useCallback((id: string) => {
    return sceneManager.getObjectById(id);
  }, [sceneManager]);

  const getThreeObject = useCallback((id: string) => {
    return sceneManager.getThreeObjectById(id);
  }, [sceneManager]);

  // Отключение
  const disconnect = useCallback(() => {
    sceneManager.disconnect();
  }, [sceneManager]);

  return {
    // Состояние
    currentScene,
    remoteUsers,
    isConnected,
    sessionId,
    isLoading,
    error,
    
    // Методы для сцены
    loadScene,
    createScene,
    saveScene,
    
    // Методы для объектов
    addObject,
    removeObject,
    updateObject,
    transformObject,
    getObject,
    getThreeObject,
    
    // Сетевые методы
    sendControllerState,
    sendSelectionUpdate,
    
    // Утилиты
    undo,
    disconnect,
    
    // Доступ к менеджеру (для продвинутого использования)
    sceneManager,
  };
}