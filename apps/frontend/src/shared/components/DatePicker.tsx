import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { fromApiDateTime, toApiDateTime } from '@/shared/utils/date.utils';
import styles from './DatePicker.module.css';

type DatePickerProps = {
  /** An RFC-3339 instant, or null when unset. */
  value: string | null;
  /** Receives an RFC-3339 instant, or null when cleared. */
  onValueChange: (value: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  'aria-label'?: string;
};

/**
 * A calendar that always emits the full RFC-3339 instant the API requires —
 * a date-only string is rejected by the `DateTime` scalar.
 */
export function DatePicker({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  clearable = true,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  'aria-label': label,
}: DatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = fromApiDateTime(value);

  const formatted = selected
    ? new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(selected)
    : null;

  return (
    <div className={styles.datePicker}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className={styles.datePickerTrigger}
            disabled={disabled}
            data-invalid={invalid ? true : undefined}
            data-placeholder={formatted ? undefined : true}
            {...(id ? { id } : {})}
            {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            {...(invalid ? { 'aria-invalid': true } : {})}
            {...(label ? { 'aria-label': label } : {})}
          >
            <CalendarDays className={styles.datePickerIcon} aria-hidden />
            <span className={styles.datePickerValue}>
              {formatted ?? placeholder}
            </span>
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className={styles.datePickerContent}
            align="start"
            sideOffset={6}
          >
            <DayPicker
              mode="single"
              {...(selected ? { selected, defaultMonth: selected } : {})}
              onSelect={(date) => {
                onValueChange(date ? toApiDateTime(date) : null);
                setOpen(false);
              }}
              showOutsideDays
              // CSS Module lookups type as `string | undefined` under
              // noUncheckedIndexedAccess, which a third-party `className?:
              // string` rejects with exactOptionalPropertyTypes.
              className={styles.datePickerCalendar ?? ''}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {clearable && formatted && !disabled ? (
        <button
          type="button"
          className={styles.datePickerClear}
          onClick={() => onValueChange(null)}
          aria-label={t('common.delete')}
        >
          <X aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
