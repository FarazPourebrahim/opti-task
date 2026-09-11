import { forwardRef } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import styles from './Input.module.css';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Decorative adornment rendered inside the control. */
  startIcon?: ReactNode;
  endSlot?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { startIcon, endSlot, className, ...rest },
  ref,
) {
  return (
    <div
      className={[styles.inputShell, className].filter(Boolean).join(' ')}
      data-invalid={rest['aria-invalid'] ? true : undefined}
      data-disabled={rest.disabled || undefined}
    >
      {startIcon ? (
        <span className={styles.inputIcon} aria-hidden>
          {startIcon}
        </span>
      ) : null}
      <input {...rest} ref={ref} className={styles.inputControl} />
      {endSlot ? <span className={styles.inputEnd}>{endSlot}</span> : null}
    </div>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        {...rest}
        ref={ref}
        rows={rows}
        className={[styles.textarea, className].filter(Boolean).join(' ')}
        data-invalid={rest['aria-invalid'] ? true : undefined}
      />
    );
  },
);
