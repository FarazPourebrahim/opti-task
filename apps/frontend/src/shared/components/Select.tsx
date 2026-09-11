import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Supplied by `Field` so label, hint and error stay associated. */
  id?: string;
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  /** Use when the select is not wrapped in a `Field`. */
  'aria-label'?: string;
};

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  'aria-label': label,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      // Radix treats '' as "no selection"; passing undefined leaves it
      // uncontrolled and the field silently stops tracking its own state.
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={styles.selectTrigger}
        data-invalid={invalid ? true : undefined}
        {...(id ? { id } : {})}
        {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
        {...(invalid ? { 'aria-invalid': true } : {})}
        {...(label ? { 'aria-label': label } : {})}
      >
        <SelectPrimitive.Value {...(placeholder ? { placeholder } : {})} />
        <SelectPrimitive.Icon className={styles.selectIcon}>
          <ChevronDown />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={styles.selectContent}
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport className={styles.selectViewport}>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled ?? false}
                className={styles.selectItem}
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator
                  className={styles.selectItemIndicator}
                >
                  <Check />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
