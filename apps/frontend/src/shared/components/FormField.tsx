import {
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@averoui/react';
import type { ReactElement } from 'react';

type FormFieldProps = {
  label: string;
  hint?: string | undefined;
  /** Already translated. Its presence is what marks the control invalid. */
  error?: string | undefined;
  disabled?: boolean | undefined;
  /** Exactly one control; it receives the id and ARIA wiring. */
  children: ReactElement;
};

/**
 * The label + control + hint + error arrangement every form in the app uses.
 *
 * Avero's `Field` is deliberately compound; this fixes the one composition we
 * need so a form reads as a list of fields rather than a list of field parts.
 */
export function FormField({
  label,
  hint,
  error,
  disabled = false,
  children,
}: FormFieldProps) {
  return (
    <Field invalid={Boolean(error)} disabled={disabled}>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl>{children}</FieldControl>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
