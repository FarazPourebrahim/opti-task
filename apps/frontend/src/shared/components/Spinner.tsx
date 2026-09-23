import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import styles from './Spinner.module.css';

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  /**
   * Announced to screen readers. Omit only when the spinner sits inside a
   * control that already announces its own busy state — a bare spinner with no
   * label is silence to anyone not looking at it.
   */
  label?: string;
};

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <span
      className={styles.spinner}
      data-size={size}
      {...(label ? { role: 'status' } : { 'aria-hidden': true })}
    >
      <svg className={styles.spinnerTrack} viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="10" />
      </svg>
      {label ? <VisuallyHidden>{label}</VisuallyHidden> : null}
    </span>
  );
}
