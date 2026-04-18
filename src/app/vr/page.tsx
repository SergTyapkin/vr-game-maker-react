// app/vr/page.tsx
'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const VRScene = dynamic(() => import('@/components/vr/VRScene'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>Загрузка VR окружения...</p>
    </div>
  ),
});

export default function VRPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div className={styles.loading}>Загрузка...</div>}>
        <VRScene />
      </Suspense>
    </div>
  );
}
