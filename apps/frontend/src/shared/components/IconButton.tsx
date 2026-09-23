import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import type { ButtonSize, ButtonVariant } from './Button';
import styles from './IconButton.module.css';

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> & {
  /**
   * Required, not optional. An icon-only control with no accessible name is
   * unusable with a screen reader, so the type system refuses to build one.
   */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      icon,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      disabled,
      className,
      type,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type ?? 'button'}
        className={[styles.iconButton, className].filter(Boolean).join(' ')}
        data-variant={variant}
        data-size={size}
        aria-label={label}
        aria-busy={isLoading || undefined}
        disabled={disabled ?? isLoading}
      >
        <span className={styles.iconButtonGlyph} aria-hidden>
          {isLoading ? <Spinner size="sm" /> : icon}
        </span>
      </button>
    );
  },
);
