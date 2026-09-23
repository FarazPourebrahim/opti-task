import * as RadixCheckbox from '@radix-ui/react-checkbox';
import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import * as RadixSwitch from '@radix-ui/react-switch';
import { Check, Minus } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './Toggle.module.css';

/*
 * Boolean and single-choice controls, built on Radix so keyboard behaviour and
 * `aria-checked` come from the library rather than being reimplemented.
 *
 * Each control carries an explicit `aria-labelledby`. Radix renders these as
 * `<button>` elements, and a `<label for>` does NOT contribute to a button's
 * accessible name — only aria-label, aria-labelledby, subtree content or title
 * do. The `<label>` is kept because it still forwards pointer clicks (a button
 * is a labelable element); the aria-labelledby is what actually names it.
 */

type CheckboxProps = {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean | 'indeterminate') => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
};

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  id,
}: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const labelId = `${controlId}-label`;
  const descriptionId = `${controlId}-description`;

  return (
    <div className={styles.toggleRow}>
      <RadixCheckbox.Root
        id={controlId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={styles.checkboxBox}
        aria-labelledby={labelId}
        {...(description ? { 'aria-describedby': descriptionId } : {})}
      >
        <RadixCheckbox.Indicator className={styles.checkboxMark}>
          {checked === 'indeterminate' ? <Minus /> : <Check />}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <div className={styles.toggleText}>
        <label className={styles.toggleLabel} htmlFor={controlId} id={labelId}>
          {label}
        </label>
        {description ? (
          <p className={styles.toggleDescription} id={descriptionId}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  id,
}: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const labelId = `${controlId}-label`;
  const descriptionId = `${controlId}-description`;

  return (
    <div className={styles.toggleRow}>
      <RadixSwitch.Root
        id={controlId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={styles.switchTrack}
        aria-labelledby={labelId}
        {...(description ? { 'aria-describedby': descriptionId } : {})}
      >
        <RadixSwitch.Thumb className={styles.switchThumb} />
      </RadixSwitch.Root>
      <div className={styles.toggleText}>
        <label className={styles.toggleLabel} htmlFor={controlId} id={labelId}>
          {label}
        </label>
        {description ? (
          <p className={styles.toggleDescription} id={descriptionId}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type RadioOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

type RadioGroupProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly RadioOption[];
  /** Names the group for assistive technology. */
  label: string;
  disabled?: boolean;
};

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * Tracks arrow-key presses in the CAPTURE phase.
 *
 * The WAI-ARIA radio pattern requires an arrow key to move focus *and* check
 * the newly focused radio. Radix implements that, but registers its own
 * document listener in the bubble phase — and React delegates events at the
 * root container, which sits inside `document`. So Radix's roving focus moves
 * focus (firing `onFocus`) before its flag is ever set, and the selection never
 * happens. Capturing at `document` runs before the event reaches the target,
 * so the flag is correct by the time focus lands.
 */
function useArrowKeyPressed(): { consume: () => boolean } {
  const pressed = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (ARROW_KEYS.includes(event.key)) pressed.current = true;
    };
    // Cleared on pointer input, NOT on keyup: Radix moves focus asynchronously,
    // so keyup lands before the focus event and would clear the flag too early.
    const onPointerDown = (): void => {
      pressed.current = false;
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, []);

  return {
    /** Reads the flag and clears it, so one arrow press selects exactly once. */
    consume: () => {
      const was = pressed.current;
      pressed.current = false;
      return was;
    },
  };
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  label,
  disabled = false,
}: RadioGroupProps) {
  const groupId = useId();
  const arrowPressed = useArrowKeyPressed();

  return (
    <RadixRadioGroup.Root
      className={styles.radioGroup}
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={disabled}
      aria-label={label}
    >
      {options.map((option) => {
        const optionId = `${groupId}-${option.value}`;
        const labelId = `${optionId}-label`;
        const descriptionId = `${optionId}-description`;

        return (
          <div key={option.value} className={styles.toggleRow}>
            <RadixRadioGroup.Item
              id={optionId}
              value={option.value}
              disabled={option.disabled ?? false}
              className={styles.radioBox}
              aria-labelledby={labelId}
              onFocus={() => {
                if (arrowPressed.consume() && !option.disabled && !disabled) {
                  onValueChange(option.value);
                }
              }}
              {...(option.description
                ? { 'aria-describedby': descriptionId }
                : {})}
            >
              <RadixRadioGroup.Indicator className={styles.radioDot} />
            </RadixRadioGroup.Item>
            <div className={styles.toggleText}>
              <label
                className={styles.toggleLabel}
                htmlFor={optionId}
                id={labelId}
              >
                {option.label}
              </label>
              {option.description ? (
                <p className={styles.toggleDescription} id={descriptionId}>
                  {option.description}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </RadixRadioGroup.Root>
  );
}
