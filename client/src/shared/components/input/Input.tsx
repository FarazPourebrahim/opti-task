import React, { useState } from "react";
import { Input as MantineInput, PasswordInput } from "@mantine/core";
import type { ReactNode } from "react";
import { DateInput } from "@mantine/dates";
import styles from "./Input.module.css";

type PropsCommon = {
  type: "regular" | "wrapper";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  radius?: "xs" | "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  error?: string | ReactNode;
  clear?: boolean;
  placeholder?: string;
  password?: boolean;
  value?: string;
  onChange?: (event?: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
};

type PropsRegular = {
  type: "regular";
} & PropsCommon;

type PropsWrapper = {
  type: "wrapper";
  label?: string | ReactNode;
  description?: string | ReactNode;
  asterisk?: boolean;
  wrapperSize?: "xs" | "sm" | "md" | "lg" | "xl";
  maskPhone?: boolean;
  isDate?: boolean;
} & PropsCommon;

type Props = PropsRegular | PropsWrapper;

export default function Input(props: Props) {
  const isControlled = props.value !== undefined;
  const [internalValue, setInternalValue] = useState(props.value ?? "");

  const value = isControlled ? props.value! : internalValue;

  const setValue = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = event.target;
    const cursorPosition = inputElement.selectionStart || 0;
    let newValue = inputElement.value;

    if (props.type === "wrapper" && props.maskPhone) {
      const digits = newValue.replace(/\D/g, "");
      const isDeleting = newValue.length < value.length;
      let newCursorPosition = cursorPosition;

      if (digits.length <= 11) {
        if (digits.length > 6) {
          newValue = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
          if (!isDeleting && cursorPosition > 4) newCursorPosition += 1;
          if (!isDeleting && cursorPosition > 8) newCursorPosition += 1;
        } else if (digits.length > 3) {
          newValue = `${digits.slice(0, 4)} ${digits.slice(4)}`;
          if (!isDeleting && cursorPosition > 4) newCursorPosition += 1;
        } else {
          newValue = digits;
        }
      } else {
        const truncated = digits.slice(0, 11);
        newValue = `${truncated.slice(0, 4)} ${truncated.slice(4, 7)} ${truncated.slice(7)}`;
        newCursorPosition = Math.min(cursorPosition, newValue.length);
      }

      setValue(newValue);

      requestAnimationFrame(() => {
        inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
      });
    } else {
      setValue(newValue);
    }

    if (props.onChange) {
      const syntheticEvent = {
        ...event,
        target: {
          ...event.target,
          value: newValue,
        },
      };
      props.onChange(syntheticEvent);
    }
  };

  const handleClear = () => {
    setValue("");
    if (props.onChange) {
      const syntheticEvent = {
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      props.onChange(syntheticEvent);
    }
  };

  const commonProps = {
    size: props.size || "md",
    radius: props.radius || "md",
    disabled: props.disabled || false,
    error: props.error,
    placeholder: props.placeholder,
    value,
    onChange: handleChange,
    rightSection:
      props.clear && value !== "" ? (
        <MantineInput.ClearButton onClick={handleClear} />
      ) : undefined,
    rightSectionPointerEvents: props.clear ? ("auto" as const) : undefined,
    required: props.required || false,
  };

  if (props.type === "regular") {
    if (props.password) {
      return (
        <PasswordInput
          {...commonProps}
          classNames={{ input: styles.mantineInput }}
        />
      );
    }
    return (
      <MantineInput
        {...commonProps}
        classNames={{ input: styles.mantineInput }}
      />
    );
  }

  if (props.type === "wrapper") {
    const InputComponent = props.password ? PasswordInput : MantineInput;

    return (
      <MantineInput.Wrapper
        className={`${
          props.maskPhone || props.isDate ? styles.ltr : ""
        } ${styles.fullWidthWrapper}`}
        size={props.wrapperSize || props.size || "md"}
        label={props.label}
        description={props.description}
        error={props.error}
        withAsterisk={props.asterisk || false}
        required={props.required || false}
        classNames={{
          root: styles.wrapperRoot,
          label: styles.wrapperLabel,
          description: styles.wrapperDescription,
          error: styles.wrapperError,
        }}
      >
        {props.isDate ? (
          <DateInput
            value={value || null}
            onChange={(val: string | null) => {
              const formatted = val || "";
              setValue(formatted);

              const syntheticEvent = {
                target: { value: formatted },
              } as React.ChangeEvent<HTMLInputElement>;
              props.onChange?.(syntheticEvent);
            }}
            valueFormat="DD/MM/YY"
            placeholder={props.placeholder || "dd/mm/yy"}
            disabled={props.disabled}
            clearable={!!props.clear}
            size={props.size || "md"}
            radius={props.radius || "md"}
            error={props.error}
            required={props.required || false}
            classNames={{ input: styles.mantineInput }}
          />
        ) : (
          <InputComponent
            {...commonProps}
            classNames={{ input: styles.mantineInput }}
          />
        )}
      </MantineInput.Wrapper>
    );
  }

  return null;
}
