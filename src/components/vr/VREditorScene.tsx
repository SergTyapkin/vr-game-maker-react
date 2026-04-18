// components/vr/VREditorScene.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { SceneManager } from '@/core/scene/SceneManager';
import { VRMenu } from './VRMenu';
import { VRScenesMenu } from './VRScenesMenu';
import { VRAddObjectPreview } from './VRAddObjectPreview';
import { VRTransformGizmo } from './VRTransformGizmo';
import { VRSelectionOutline } from './VRSelectionOutline';
import { VRControllerRay } from './VRControllerRay';
import {useXRControllers} from "@/core/vr/xr-tracking/hooks/useXRControllers";
import {useXRHead} from "@/core/vr/xr-tracking/hooks/useXRHead";
import {useXR} from "@/core/vr/xr-tracking/hooks/useXR";
import {VREditorManager} from "@/core/vr/vrEditorManager";

interface VREditorSceneProps {
  initialSceneId?: string;
  onExit?: () => void;
}

export function VREditorScene({ initialSceneId, onExit }: VREditorSceneProps) {
  const { scene, camera } = useThree();
  const { isPresenting } = useXR();
  const { left, right } = useXRControllers();
  const headState = useXRHead();

  const editorManager = useRef(VREditorManager.getInstance()).current;
  const sceneManager = useRef(SceneManager.getInstance()).current;

  const [editorState, setEditorState] = useState(editorManager.getState());
  const [currentScene, setCurrentScene] = useState(sceneManager.getCurrentScene());
  const [isLoading, setIsLoading] = useState(true);
  const [menuButtons, setMenuButtons] = useState(editorManager.getMainMenuButtons());

  // Инициализация
  useEffect(() => {
    const init = async () => {
      sceneManager.initThreeScene(scene);

      // Подключаемся к серверу
      await sceneManager.connect();

      // Загружаем сцену
      if (initialSceneId) {
        await sceneManager.loadScene(initialSceneId);
      } else {
        // Создаем новую сцену если не указана
        sceneManager.createScene('Новая сцена');
      }

      setCurrentScene(sceneManager.getCurrentScene());
      setIsLoading(false);
    };

    init();

    // Подписки на события
    const handleStateChange = () => {
      setEditorState(editorManager.getState());
      updateMenuButtons();
    };

    const handleSceneChange = () => {
      setCurrentScene(sceneManager.getCurrentScene());
    };

    editorManager.on('tool:activated', handleStateChange);
    editorManager.on('menu:opened', handleStateChange);
    editorManager.on('menu:closed', handleStateChange);
    editorManager.on('object:selected', handleStateChange);
    editorManager.on('adding:started', handleStateChange);
    editorManager.on('adding:completed', handleStateChange);
    editorManager.on('adding:cancelled', handleStateChange);

    sceneManager.on('scene:loaded', handleSceneChange);
    sceneManager.on('scene:created', handleSceneChange);

    return () => {
      editorManager.removeAllListeners();
      sceneManager.removeAllListeners();
    };
  }, [scene, initialSceneId]);

  // Обновление кнопок меню при изменении состояния
  const updateMenuButtons = useCallback(() => {
    const state = editorManager.getState();

    switch (state.activeMenu) {
      case 'add':
        setMenuButtons(editorManager.getAddMenuButtons());
        break;
      case 'scenes':
        // Кнопки для меню сцен будут в отдельном компоненте
        break;
      default:
        setMenuButtons(editorManager.getMainMenuButtons());
    }
  }, [editorManager]);

  // Обработка ввода с контроллеров
  useFrame((state, deltaTime) => {
    if (!isPresenting) return;

    // Обновляем состояние контроллеров в менеджере
    const controllers = { left, right };
    editorManager.update(deltaTime, controllers);

    // Обработка кнопок контроллеров
    handleControllerInput(left, 'left');
    handleControllerInput(right, 'right');
  });

  const handleControllerInput = (controller: any, hand: 'left' | 'right') => {
    if (!controller) return;

    // Кнопка меню (A на левом контроллере)
    if (hand === 'left' && controller.buttons?.a?.pressed && !controller.prevButtons?.a?.pressed) {
      editorManager.toggleMenu();
    }

    // Триггер для действия (правый контроллер)
    if (hand === 'right' && controller.buttons?.trigger?.pressed) {
      handleTriggerAction(controller);
    }

    // Кнопка B для отмены
    if (controller.buttons?.b?.pressed && !controller.prevButtons?.b?.pressed) {
      if (editorManager.isInAddMode()) {
        editorManager.cancelAddObject();
      } else {
        editorManager.selectObject(null);
      }
    }

    // Сохраняем предыдущее состояние кнопок
    controller.prevButtons = { ...controller.buttons };
  };

  const handleTriggerAction = (controller: any) => {
    const state = editorManager.getState();

    if (state.mode === 'add') {
      // Подтверждаем добавление объекта
      editorManager.confirmAddObject(controller.position, controller.rotation);
    }
  };

  // Выход из редактора
  const handleExit = () => {
    editorManager.closeMenu();
    onExit?.();
  };

  // Рендер меню в зависимости от состояния
  const renderMenu = () => {
    const state = editorManager.getState();

    if (!state.isMenuOpen) return null;

    switch (state.activeMenu) {
      case 'scenes':
        return (
          <VRScenesMenu
            onSelectScene={async (sceneId) => {
              await editorManager.loadScene(sceneId);
              editorManager.openMenu('main');
            }}
            onCreateScene={async (name) => {
              await editorManager.createNewScene(name);
              editorManager.openMenu('main');
            }}
            onBack={() => editorManager.openMenu('main')}
            currentSceneId={currentScene?.id}
          />
        );

      case 'settings':
        return (
          <VRMenu
            title="Настройки"
            buttons={[
              {
                id: 'back',
                label: '← Назад',
                action: () => editorManager.openMenu('main'),
              },
              {
                id: 'snap-toggle',
                label: `Привязка: ${state.snapEnabled ? 'Вкл' : 'Выкл'}`,
                action: () => {
                  // Переключение привязки
                },
              },
              {
                id: 'exit',
                label: 'Выйти из редактора',
                action: handleExit,
                variant: 'danger',
              },
            ]}
            attachToHead
            distance={1.5}
          />
        );

      default:
        return (
          <VRMenu
            title="VR Редактор"
            buttons={menuButtons}
            attachToHead
            distance={1.5}
          />
        );
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <group>
      {/* Лучи контроллеров */}
      <VRControllerRay controller={left} color="#2563eb" />
      <VRControllerRay controller={right} color="#ef4444" />

      {/* Меню */}
      {renderMenu()}

      {/* Превью добавляемого объекта */}
      {editorState.mode === 'add' && (
        <VRAddObjectPreview
          type={editorState.addObjectType!}
          subType={editorState.addObjectSubType!}
          controller={right}
        />
      )}

      {/* Гизмо трансформации */}
      {editorState.mode === 'transform' && editorState.selectedObjectId && (
        <VRTransformGizmo
          objectId={editorState.selectedObjectId}
          mode={editorState.transformMode}
          snapEnabled={editorState.snapEnabled}
          snapValue={editorState.snapValue}
          onTransform={(transform) => editorManager.transformSelectedObject(transform)}
        />
      )}

      {/* Подсветка выбранного объекта */}
      {editorState.selectedObjectId && (
        <VRSelectionOutline objectId={editorState.selectedObjectId} />
      )}
    </group>
  );
}
