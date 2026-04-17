// components/ui/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'vr';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export const Button = ({
                         children,
                         variant = 'primary',
                         size = 'md',
                         icon,
                         className = '',
                         ...props
                       }: ButtonProps) => {
  const buttonClasses = [
    styles.button,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={buttonClasses} {...props}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </button>
  );
};
