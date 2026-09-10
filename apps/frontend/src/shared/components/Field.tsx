import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './Field.module.css';

type FieldRenderProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean | undefined;
};

type FieldProps = {
  label: ReactNode;
  /** Supporting copy shown under the control. */
  hint?: ReactNode;
  /** When present the field renders as invalid and announces the message. */
  error?: string | undefined;
  required?: boolean;
  /**
   * Receives the wiring the control must spread onto itself. Passing it through
   * a render prop is what guarantees label, hint and error are actually
   * associated — a caller cannot forget to link them.
   */
  children: (props: FieldRenderProps) => ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={styles.field} data-invalid={error ? true : undefined}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
        {required ? (
          <span className={styles.fieldRequired} aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint ? (
        <p className={styles.fieldHint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        // `role="alert"` so the message is announced when it appears, not only
        // when the control is next focused.
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
