import {
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@averoui/react';

export type SelectOption<Value extends string> = {
  value: Value;
  label: string;
};

type SelectFieldProps<Value extends string> = {
  label: string;
  value: Value;
  onValueChange: (value: Value) => void;
  options: ReadonlyArray<SelectOption<Value>>;
  hint?: string | undefined;
  /** Already translated. Its presence is what marks the control invalid. */
  error?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
};

/**
 * A labelled select, the counterpart of `FormField` for a choice.
 *
 * `FormField` cannot wrap a `Select`: the field's id and ARIA state must land
 * on the trigger button, which sits one level inside the select's root.
 */
export function SelectField<Value extends string>({
  label,
  value,
  onValueChange,
  options,
  hint,
  error,
  disabled = false,
  className,
}: SelectFieldProps<Value>) {
  return (
    <Field
      invalid={Boolean(error)}
      disabled={disabled}
      {...(className ? { className } : {})}
    >
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          // Radix reports a plain string; only the offered values can occur.
          const option = options.find((candidate) => candidate.value === next);
          if (option) onValueChange(option.value);
        }}
      >
        <FieldControl>
          {/* Named explicitly as well as by the label: the trigger is a button
              with the combobox role, whose text is its value, not its name,
              and not every tool follows a `<label for>` to a button. */}
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
        </FieldControl>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
