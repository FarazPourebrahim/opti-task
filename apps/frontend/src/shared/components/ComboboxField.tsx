import {
  Combobox,
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@averoui/react';

export type ComboboxOption<Value extends string> = {
  value: Value;
  label: string;
  /** Optional extra terms that should match when the user searches. */
  keywords?: string[];
};

type ComboboxFieldProps<Value extends string> = {
  label: string;
  value: Value;
  onValueChange: (value: Value) => void;
  options: ReadonlyArray<ComboboxOption<Value>>;
  hint?: string | undefined;
  /** Already translated. Its presence is what marks the control invalid. */
  error?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  placeholder?: string | undefined;
  name?: string | undefined;
};

/**
 * A labelled, searchable single-select field built with Avero's Combobox.
 */
export function ComboboxField<Value extends string>({
  label,
  value,
  onValueChange,
  options,
  hint,
  error,
  disabled = false,
  className,
  placeholder,
  name,
}: ComboboxFieldProps<Value>) {
  return (
    <Field
      invalid={Boolean(error)}
      disabled={disabled}
      {...(className ? { className } : {})}
    >
      <FieldLabel>{label}</FieldLabel>
      <FieldControl>
        <Combobox
          aria-label={label}
          value={value}
          onValueChange={(next) => {
            const option = options.find(
              (candidate) => candidate.value === next,
            );
            if (option) onValueChange(option.value);
          }}
          options={options.map(
            ({ value: optionValue, label: optionLabel, keywords }) => ({
              value: optionValue,
              label: optionLabel,
              ...(keywords ? { keywords } : {}),
            }),
          )}
          disabled={disabled}
          {...(placeholder ? { placeholder } : {})}
          {...(name ? { name } : {})}
        />
      </FieldControl>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
