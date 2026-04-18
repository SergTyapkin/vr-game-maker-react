// app/editor/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

const navigationItems = [
  {
    path: '/editor/code',
    label: 'Код',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    description: 'Редактор кода',
  },
  {
    path: '/editor/textures',
    label: 'Текстуры',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <path d="M21 15l-5-5L7 21" />
      </svg>
    ),
    description: 'Управление текстурами',
  },
  {
    path: '/editor/materials',
    label: 'Материалы',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    description: 'Управление материалами',
  },
  {
    path: '/editor/models',
    label: '3D Модели',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7v10l10 5 10-5V7l-10-5z" />
        <path d="M2 7l10 5 10-5M12 22V12" />
      </svg>
    ),
    description: 'Управление моделями',
  },
  {
    path: '/editor/scenes',
    label: 'Сцены',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
      </svg>
    ),
    description: 'Управление сценами',
  },
];

export default function EditorLayout({
                                       children,
                                     }: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.layout}>
      {/* Боковое меню */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/editor" className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2L2 7v10l10 5 10-5V7l-10-5z" strokeWidth="2" />
            </svg>
            <span>VR Editor</span>
          </Link>
        </div>

        <nav className={styles.navigation}>
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`${styles.navItem} ${
                pathname === item.path ? styles.active : ''
              }`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <div className={styles.navContent}>
                <span className={styles.navLabel}>{item.label}</span>
                <span className={styles.navDescription}>{item.description}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.backButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeWidth="2" />
            </svg>
            На главную
          </Link>
        </div>
      </aside>

      {/* Основной контент */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
