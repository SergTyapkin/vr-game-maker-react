import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>
            VR Game Studio
          </h1>
          <p className={styles.subtitle}>
            Создавай VR-игры вместе с командой в реальном времени
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className={styles.main}>
        <div className={styles.cardsGrid}>
          {/* Card 1: Редактировать в браузере */}
          <Link href="/editor" className={styles.cardLink}>
            <Card hover>
              <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconWrapper} ${styles.iconEditor}`}>
                    <svg className={styles.iconSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h2 className={styles.cardTitle}>
                    Редактировать в браузере
                  </h2>
                  <p className={styles.cardDescription}>
                    Управляйте кодом, текстурами, материалами и 3D-моделями через удобный веб-интерфейс
                  </p>
                </div>

                <div className={styles.featuresList}>
                  <div className={styles.featureItem}>
                    <span className={styles.featureDot}></span>
                    Редактор кода с подсветкой синтаксиса
                  </div>
                  <div className={styles.featureItem}>
                    <span className={styles.featureDot}></span>
                    Управление ресурсами в реальном времени
                  </div>
                  <div className={styles.featureItem}>
                    <span className={styles.featureDot}></span>
                    Мгновенная синхронизация с VR
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <Button
                    variant="primary"
                    size="lg"
                    className={styles.fullWidth}
                    icon={
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    }
                  >
                    Открыть редактор
                  </Button>
                </div>
              </div>
            </Card>
          </Link>

          {/* Card 2: Войти в VR */}
          <Link href="/vr" className={styles.cardLink}>
            <Card hover className={styles.vrCard}>
              <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconWrapper} ${styles.iconVr}`}>
                    <svg className={styles.iconSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className={styles.cardTitle}>
                    Войти в VR
                  </h2>
                  <p className={styles.cardDescription}>
                    Погрузитесь в виртуальную реальность и редактируйте сцены интуитивно понятными жестами
                  </p>
                </div>

                <div className={styles.featuresList}>
                  <div className={`${styles.featureItem} ${styles.featureItemVr}`}>
                    <span className={`${styles.featureDot} ${styles.featureDotVr}`}></span>
                    Редактирование сцен в реальном времени
                  </div>
                  <div className={`${styles.featureItem} ${styles.featureItemVr}`}>
                    <span className={`${styles.featureDot} ${styles.featureDotVr}`}></span>
                    Интерактивное размещение объектов
                  </div>
                  <div className={`${styles.featureItem} ${styles.featureItemVr}`}>
                    <span className={`${styles.featureDot} ${styles.featureDotVr}`}></span>
                    Мгновенное тестирование игровой логики
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <Button
                    variant="vr"
                    size="lg"
                    className={styles.fullWidth}
                    icon={
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    }
                  >
                    Запустить VR
                  </Button>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Footer Info */}
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Требуется WebXR-совместимый браузер и VR-гарнитура для работы в режиме VR
          </p>
        </div>
      </div>
    </div>
  );
}
