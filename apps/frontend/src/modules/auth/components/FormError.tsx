import { AlertCircle } from 'lucide-react';
import styles from './FormError.module.css';

type FormErrorProps = {
  /** Already translated: the caller decides which key applies. */
  message: string | null;
};

/**
 * A form-level error banner.
 *
 * Form-level rather than per-field because the API returns only a stable
 * `code` — it carries no per-field detail — so a server rejection cannot be
 * attributed to one input. Client-side validation handles the per-field case.
 *
 * `role="alert"` so the message is announced when it appears, not only when
 * the user next moves focus.
 */
export function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <p className={styles.formError} role="alert">
      <AlertCircle className={styles.formErrorIcon} aria-hidden />
      {message}
    </p>
  );
}
