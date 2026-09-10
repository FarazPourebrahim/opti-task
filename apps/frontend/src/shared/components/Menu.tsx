import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Menu.module.css';

/*
 * Menus on Radix: roving focus, type-ahead, Escape to close, and focus return
 * to the trigger all come from the primitive. The wrappers below only supply
 * structure and styling.
 */

type MenuProps = {
  /** The control that opens the menu. Must be focusable. */
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
};

/**
 * A menu opened by a button is named by that button — Radix wires
 * `aria-labelledby` to the trigger, and that is the correct ARIA pattern. There
 * is deliberately no `label` prop: an `aria-label` here would be silently
 * overridden by the labelledby reference and give a false sense of coverage.
 */
export function Menu({ trigger, children, align = 'start' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menu}
          align={align}
          sideOffset={6}
          collisionPadding={8}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type MenuItemProps = {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  /** Renders in the danger colour; use for destructive actions. */
  destructive?: boolean;
  disabled?: boolean;
  shortcut?: string;
};

export function MenuItem({
  children,
  onSelect,
  icon,
  destructive = false,
  disabled = false,
  shortcut,
}: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={styles.menuItem}
      data-destructive={destructive || undefined}
      disabled={disabled}
      {...(onSelect ? { onSelect } : {})}
    >
      {icon ? (
        <span className={styles.menuItemIcon} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className={styles.menuItemLabel}>{children}</span>
      {shortcut ? (
        <span className={styles.menuItemShortcut}>{shortcut}</span>
      ) : null}
    </DropdownMenu.Item>
  );
}

type MenuCheckboxItemProps = {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  disabled = false,
}: MenuCheckboxItemProps) {
  return (
    <DropdownMenu.CheckboxItem
      className={styles.menuItem}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    >
      <span className={styles.menuItemIcon} aria-hidden>
        <DropdownMenu.ItemIndicator>
          <Check />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className={styles.menuItemLabel}>{children}</span>
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.menuSeparator} />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className={styles.menuLabel}>{children}</DropdownMenu.Label>;
}

type ContextMenuProps = {
  /** The region that responds to a right-click. */
  children: ReactNode;
  items: ReactNode;
};

export function ContextMenu({ children, items }: ContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {children}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          className={styles.menu}
          collisionPadding={8}
        >
          {items}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

export function ContextMenuItem({
  children,
  onSelect,
  icon,
  destructive = false,
  disabled = false,
}: Omit<MenuItemProps, 'shortcut'>) {
  return (
    <ContextMenuPrimitive.Item
      className={styles.menuItem}
      data-destructive={destructive || undefined}
      disabled={disabled}
      {...(onSelect ? { onSelect } : {})}
    >
      {icon ? (
        <span className={styles.menuItemIcon} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className={styles.menuItemLabel}>{children}</span>
    </ContextMenuPrimitive.Item>
  );
}
