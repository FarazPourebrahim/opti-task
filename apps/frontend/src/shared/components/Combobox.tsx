import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import styles from './Combobox.module.css';

export type ComboboxOption = {
  value: string;
  label: string;
  /** Extra text matched while typing but not shown as the trigger label. */
  keywords?: string[];
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type ComboboxProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  id?: string;
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  'aria-label'?: string;
};

/**
 * A searchable single-select, for lists too long to scan in a `Select`
 * (people, projects, labels).
 *
 * Built on cmdk inside a Radix Popover: cmdk owns filtering, the listbox roles
 * and arrow/Enter behaviour; the popover owns dismissal and focus return.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  'aria-label': label,
}: ComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={styles.comboboxTrigger}
          disabled={disabled}
          data-invalid={invalid ? true : undefined}
          data-placeholder={selected ? undefined : true}
          {...(id ? { id } : {})}
          {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
          {...(describedBy ? { 'aria-describedby': describedBy } : {})}
          {...(invalid ? { 'aria-invalid': true } : {})}
          {...(label ? { 'aria-label': label } : {})}
        >
          <span className={styles.comboboxValue}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className={styles.comboboxIcon} aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={styles.comboboxContent}
          align="start"
          sideOffset={6}
        >
          <Command className={styles.comboboxCommand} label={t('common.search')}>
            <Command.Input
              className={styles.comboboxInput}
              placeholder={searchPlaceholder}
            />
            <Command.List className={styles.comboboxList}>
              <Command.Empty className={styles.comboboxEmpty}>
                {emptyMessage}
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.label}
                  keywords={option.keywords ?? []}
                  disabled={option.disabled ?? false}
                  className={styles.comboboxItem}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.icon ? (
                    <span className={styles.comboboxItemIcon} aria-hidden>
                      {option.icon}
                    </span>
                  ) : null}
                  <span className={styles.comboboxItemText}>
                    <span className={styles.comboboxItemLabel}>
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className={styles.comboboxItemDescription}>
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.value === value ? (
                    <Check className={styles.comboboxItemCheck} aria-hidden />
                  ) : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
