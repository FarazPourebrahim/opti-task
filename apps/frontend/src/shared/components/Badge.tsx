import * as ProgressPrimitive from '@radix-ui/react-progress';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
};

/**
 * A status marker. Colour alone never carries the meaning — the label is always
 * present, so the badge stays readable without colour perception.
 */
export function Badge({ children, tone = 'neutral', icon }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {icon ? (
        <span className={styles.badgeIcon} aria-hidden>
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

type ChipProps = {
  children: ReactNode;
  /** Renders a remove control; omit for a read-only chip. */
  onRemove?: () => void;
  removeLabel?: string;
  color?: string | null;
};

export function Chip({ children, onRemove, removeLabel, color }: ChipProps) {
  return (
    <span className={styles.chip}>
      {color ? (
        <span
          className={styles.chipDot}
          style={{ backgroundColor: color }}
          aria-hidden
        />
      ) : null}
      <span className={styles.chipLabel}>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className={styles.chipRemove}
          onClick={onRemove}
          aria-label={removeLabel ?? String(children)}
        >
          <X aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

/** Renders a keyboard key, e.g. in a menu shortcut or a hint. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

type ProgressBarProps = {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  label: string;
  /** Shows the numeric value beside the bar. */
  showValue?: boolean;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
};

export function ProgressBar({
  value,
  label,
  showValue = false,
  tone = 'primary',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={styles.progress}>
      <div className={styles.progressHeader}>
        <span className={styles.progressLabel}>{label}</span>
        {showValue ? (
          <span className={styles.progressValue}>{clamped}%</span>
        ) : null}
      </div>
      <ProgressPrimitive.Root
        className={styles.progressTrack}
        value={clamped}
        data-tone={tone}
        aria-label={label}
      >
        <ProgressPrimitive.Indicator
          className={styles.progressIndicator}
          style={{ inlineSize: `${clamped}%` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}
