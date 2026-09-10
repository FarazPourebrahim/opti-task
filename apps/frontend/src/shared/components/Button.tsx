import { Slot, Slottable } from '@radix-ui/react-slot';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and swaps the leading icon for a spinner. */
  isLoading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** Renders the child element instead of a <button> (e.g. an anchor). */
  asChild?: boolean;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      startIcon,
      endIcon,
      asChild = false,
      fullWidth = false,
      disabled,
      children,
      className,
      type,
      ...rest
    },
    ref,
  ) {
    const Component = asChild ? Slot : 'button';

    return (
      <Component
        {...rest}
        ref={ref}
        className={[styles.button, className].filter(Boolean).join(' ')}
        data-variant={variant}
        data-size={size}
        data-full-width={fullWidth || undefined}
        // A pending action must not be re-submittable, and `aria-busy` tells
        // assistive tech why the control went quiet.
        disabled={disabled ?? isLoading}
        aria-busy={isLoading || undefined}
        {...(asChild ? {} : { type: type ?? 'button' })}
      >
        {isLoading ? (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        ) : startIcon ? (
          <span className={styles.buttonIcon} aria-hidden>
            {startIcon}
          </span>
        ) : null}
        {/*
          Slottable marks which child `asChild` should merge onto, so the icons
          survive as siblings inside the rendered element. Outside a Slot it is
          a transparent passthrough, so the non-asChild path is unaffected.
        */}
        <Slottable>{children}</Slottable>
        {endIcon && !isLoading ? (
          <span className={styles.buttonIcon} aria-hidden>
            {endIcon}
          </span>
        ) : null}
      </Component>
    );
  },
);
