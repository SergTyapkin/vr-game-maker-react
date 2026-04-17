// app/vr/page.tsx
'use client';

import dynamic from 'next/dynamic';
import styles from './page.module.css';

// Динамический импорт для избежания SSR проблем с Three.js
const VRScene = dynamic(() => import('@/components/vr/VRScene'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.loadingSpinner}></div>
      <p>Загрузка VR окружения...</p>
    </div>
  ),
});

export default function VRPage() {
  return (
    <div className={styles.container}>
      <VRScene />
    </div>
  );
}
