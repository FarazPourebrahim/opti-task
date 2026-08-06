import {
  ActionIcon,
  Button as MantineButton,
  CopyButton,
  Tooltip,
  CloseButton,
} from "@mantine/core";
import type { ReactNode, MouseEventHandler } from "react";
import MingcuteCheckFill from "../../assets/icons/MingcuteCheckFill.tsx";
import MingcuteCopy2Line from "../../assets/icons/MingcuteCopy2Line.tsx";
import { Link } from "react-router-dom";

type PropsRegular = {
  type: "regular";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  radius?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "filled" | "light" | "outline" | "subtle" | "transparent" | "white";
  color?: "primary" | "accent" | "success" | "error" | "warning";
  textColor?:
    | "primary"
    | "accent"
    | "success"
    | "error"
    | "warning"
    | "white"
    | "gray"
    | "black";
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  children: ReactNode;
  href?: string;
  disabled?: boolean;
  fullWidth?: boolean;
};

type PropsClose = {
  type: "close";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "transparent" | "subtle";
  textColor?:
    | "primary"
    | "accent"
    | "success"
    | "error"
    | "warning"
    | "white"
    | "gray"
    | "black";
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  children?: ReactNode;
};

type PropsCopy = {
  type: "copy";
  color: "white" | "gray" | "black";
  textColor?:
    | "primary"
    | "accent"
    | "success"
    | "error"
    | "warning"
    | "white"
    | "gray"
    | "black";
  value: string;
};

type Props = PropsRegular | PropsClose | PropsCopy;

const colorMap: Record<string, string> = {
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  error: "var(--color-danger)",
  warning: "var(--color-warning)",
  white: "var(--color-gray-100)",
  gray: "var(--color-gray-50)",
  black: "var(--color-gray-10)",
};

export default function Button(props: Props) {
  return (
    <>
      {props.type === "regular" &&
        (props.href ? (
          <Link to={props.href} style={{ textDecoration: "none" }}>
            <MantineButton
              size={props.size || "md"}
              radius={props.radius || "md"}
              variant={props.variant || "filled"}
              color={props.color ? colorMap[props.color] : colorMap.primary}
              c={props.textColor ? colorMap[props.textColor] : undefined}
              onClick={props.onClick}
              disabled={props.disabled}
              fullWidth={props.fullWidth || false}
            >
              {props.children}
            </MantineButton>
          </Link>
        ) : (
          <MantineButton
            size={props.size || "md"}
            radius={props.radius || "md"}
            variant={props.variant || "filled"}
            color={props.color ? colorMap[props.color] : colorMap.primary}
            c={props.textColor ? colorMap[props.textColor] : undefined}
            onClick={props.onClick}
            disabled={props.disabled}
            fullWidth={props.fullWidth || false}
          >
            {props.children}
          </MantineButton>
        ))}
      {props.type === "copy" && (
        <CopyButton value={props.value} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? "Copied" : "Copy"}
              withArrow
              position="right"
            >
              <ActionIcon
                color={colorMap[props.color]}
                variant="subtle"
                onClick={copy}
                c={props.textColor ? colorMap[props.textColor] : undefined}
              >
                {copied ? <MingcuteCheckFill /> : <MingcuteCopy2Line />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      )}
      {props.type === "close" && (
        <CloseButton
          size={props.size || "md"}
          variant={props.variant || "transparent"}
          c={props.textColor ? colorMap[props.textColor] : undefined}
          onClick={props.onClick}
        />
      )}
    </>
  );
}
