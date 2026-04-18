// components/vr/GameMode.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { GameEngine } from '@/core/game/GameEngine';
import { SceneManager } from '@/core/scene/SceneManager';
import * as THREE from 'three';
import {useXRControllers} from "@/core/vr/xr-tracking/hooks/useXRControllers";
import {useXRHead} from "@/core/vr/xr-tracking/hooks/useXRHead";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";

interface GameModeProps {
  sceneId: string;
  onExit?: () => void;
}

export function GameMode({ sceneId, onExit }: GameModeProps) {
  const { scene } = useThree();
  const { isPresenting } = useXR();
  const { left, right } = useXRControllers();
  const headState = useXRHead();

  const gameEngine = useRef(GameEngine.getInstance()).current;
  const sceneManager = useRef(SceneManager.getInstance()).current;
  const [isGameReady, setIsGameReady] = useState(false);
  const [gameState, setGameState] = useState(gameEngine.getGameState());

  // Инициализация
  useEffect(() => {
    const initGame = async () => {
      sceneManager.initThreeScene(scene);

      // Устанавливаем пользователя VR
      sceneManager.setCurrentUser({
        id: 'vr-player',
        name: 'VR Player',
        sessionType: 'vr',
      });

      // Подключаемся к сцене
      await sceneManager.connect();
      await gameEngine.loadScene(sceneId);

      setIsGameReady(true);
    };

    initGame();

    // Подписка на изменения состояния
    const handleStateChange = () => {
      setGameState(gameEngine.getGameState());
    };

    gameEngine.on('game:started', handleStateChange);
    gameEngine.on('game:paused', handleStateChange);
    gameEngine.on('game:resumed', handleStateChange);
    gameEngine.on('game:stopped', handleStateChange);

    return () => {
      gameEngine.off('game:started', handleStateChange);
      gameEngine.off('game:paused', handleStateChange);
      gameEngine.off('game:resumed', handleStateChange);
      gameEngine.off('game:stopped', handleStateChange);
      gameEngine.stopGame();
    };
  }, [scene, sceneId]);

  // Запуск игры когда все готово
  useEffect(() => {
    if (isGameReady && isPresenting) {
      gameEngine.startGame();
    }
  }, [isGameReady, isPresenting]);

  // Обработка ввода с контроллеров
  useEffect(() => {
    if (!gameEngine.isPlaying()) return;

    const handleInput = () => {
      // Движение с левого контроллера
      if (left) {
        const moveX = left.thumbstick?.x || 0;
        const moveY = left.thumbstick?.y || 0;

        if (Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1) {
          gameEngine.emitGameEvent('input:move', {
            x: moveX,
            y: moveY,
          });
        }

        // Прыжок с кнопки A
        if (left.buttons?.a?.pressed) {
          gameEngine.emitGameEvent('input:jump');
        }
      }

      // Поворот с правого контроллера
      if (right) {
        const lookX = right.thumbstick?.x || 0;

        if (Math.abs(lookX) > 0.1) {
          gameEngine.emitGameEvent('input:look', {
            x: lookX,
          });
        }

        // Взаимодействие с кнопки триггера
        if (right.buttons?.trigger?.pressed) {
          gameEngine.emitGameEvent('input:interact');
        }
      }

      // Обновляем позицию игрока из VR
      if (headState) {
        const player = gameEngine.getPlayer();
        if (player) {
          gameEngine.setPlayerPosition(headState.centerPosition);
        }
      }
    };

    const interval = setInterval(handleInput, 16); // ~60fps

    return () => clearInterval(interval);
  }, [left, right, headState, gameEngine]);

  // Меню паузы (можно активировать кнопкой меню)
  if (gameState.isPaused) {
    return (
      <group position={[0, 1.6, -1]}>
        {/* Здесь можно отрисовать меню паузы */}
      </group>
    );
  }

  return null;
}
