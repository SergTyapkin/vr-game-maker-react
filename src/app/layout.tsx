// app/layout.tsx
import type { Metadata } from 'next';
import '../styles/global.css';

export const metadata: Metadata = {
  title: 'VR Game Studio',
  description: 'Создавай VR-игры вместе с командой в реальном времени',
};

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
    <body>
    {children}
    </body>
    </html>
  );
}
