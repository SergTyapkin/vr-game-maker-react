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
  }, [options.user]);

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

    const handleUserJoined = (user: SceneUser) => {
      setRemoteUsers(sceneManager.getRemoteUsers());
    };

    const handleUserLeft = (user: SceneUser) => {
      setRemoteUsers(sceneManager.getRemoteUsers());
    };

    const handleError = (err: Error) => {
      setError(err);
    };

    sceneManager.on('ws:connected', handleConnected);
    sceneManager.on('ws:disconnected', handleDisconnected);
    sceneManager.on('scene:loaded', handleSceneLoaded);
    sceneManager.on('scene:synced', handleSceneSynced);
    sceneManager.on('user:joined', handleUserJoined);
    sceneManager.on('user:left', handleUserLeft);
    sceneManager.on('scene:error', handleError);
    sceneManager.on('ws:error', handleError);

    return () => {
      sceneManager
