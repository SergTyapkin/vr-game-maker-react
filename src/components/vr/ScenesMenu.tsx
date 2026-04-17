// components/vr/ScenesMenu.tsx
'use client';

import { useState } from 'react';
import { VRMenu } from './VRMenu';

interface ScenesMenuProps {
  onBack: () => void;
  onSelectScene: (sceneId: string) => void;
}

// Моковые данные сцен
const mockScenes = [
  { id: '1', name: 'Scene 1', preview: null },
  { id: '2', name: 'Scene 2', preview: null },
  { id: '3', name: 'Scene 3', preview: null },
];

export function ScenesMenu({ onBack, onSelectScene }: ScenesMenuProps) {
  const [scenes] = useState(mockScenes);

  const buttons = [
    ...scenes.map(scene => ({
      id: `scene-${scene.id}`,
      label: scene.name,
      variant: 'secondary' as const,
      onClick: () => onSelectScene(scene.id),
    })),
    {
      id: 'create-new',
      label: '+ Create scene',
      variant: 'primary' as const,
      onClick: () => {
        console.log('Create new scene');
        // Здесь будет создание новой сцены
      },
    },
    {
      id: 'back',
      label: '<- Back',
      variant: 'secondary' as const,
      onClick: onBack,
    },
  ];

  return (
    <VRMenu
      title="Scenes"
      buttons={buttons}
      attachToHead={true}
      distance={2}
    />
  );
}
