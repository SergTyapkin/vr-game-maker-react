// app/editor/page.tsx
'use client';

import Link from 'next/link';
import styles from './page.module.css';

const quickActions = [
  {
    title: 'Редактор кода',
    description: 'Пишите и редактируйте скрипты поведения объектов',
    path: '/editor/code',
    icon: '📝',
    stats: { label: 'Файлов', value: '12' },
  },
  {
    title: 'Текстуры',
    description: 'Загружайте и управляйте текстурами для материалов',
    path: '/editor/textures',
    icon: '🖼️',
    stats: { label: 'Текстур', value: '24' },
  },
  {
    title: 'Материалы',
    description: 'Создавайте и настраивайте материалы с шейдерами',
    path: '/editor/materials',
    icon: '🎨',
    stats: { label: 'Материалов', value: '8' },
  },
  {
    title: '3D Модели',
    description: 'Импортируйте GLTF, FBX и другие форматы',
    path: '/editor/models',
    icon: '🗿',
    stats: { label: 'Моделей', value: '6' },
  },
  {
    title: 'Сцены',
    description: 'Создавайте и редактируйте игровые сцены',
    path: '/editor/scenes',
    icon: '🎬',
    stats: { label: 'Сцен', value: '3' },
  },
];

export default function EditorPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Редактор проекта</h1>
        <p className={styles.subtitle}>
          Управляйте ресурсами вашей VR-игры через удобный веб-интерфейс
        </p>
      </header>

      <div className={styles.grid}>
        {quickActions.map((action) => (
          <Link key={action.path} href={action.path} className={styles.card}>
            <div className={styles.cardIcon}>{action.icon}</div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>{action.title}</h3>
              <p className={styles.cardDescription}>{action.description}</p>
              <div className={styles.cardStats}>
                <span className={styles.statsLabel}>{action.stats.label}:</span>
                <span className={styles.statsValue}>{action.stats.value}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className={styles.recentSection}>
        <h2 className={styles.sectionTitle}>Недавние изменения</h2>
        <div className={styles.recentList}>
          <div className={styles.recentItem}>
            <span className={styles.recentTime}>5 мин назад</span>
            <span className={styles.recentAction}>Изменен файл DoorController.js</span>
          </div>
          <div className={styles.recentItem}>
            <span className={styles.recentTime}>1 час назад</span>
            <span className={styles.recentAction}>Загружена текстура wood_diffuse.png</span>
          </div>
          <div className={styles.recentItem}>
            <span className={styles.recentTime}>3 часа назад</span>
            <span className={styles.recentAction}>Создана сцена "Test Level"</span>
          </div>
        </div>
      </div>
    </div>
  );
}
