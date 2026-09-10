import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import styles from './Popover.module.css';

type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  /** Names the popover surface for assistive technology. */
  label: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Popover({
  trigger,
  children,
  label,
  align = 'start',
  side = 'bottom',
  open,
  onOpenChange,
}: PopoverProps) {
  return (
    <PopoverPrimitive.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={styles.popover}
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          aria-label={label}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * Wraps the app once so tooltips share a delay group — moving between adjacent
 * tooltips then feels instant instead of re-waiting the open delay each time.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

type TooltipProps = {
  children: ReactNode;
  /**
   * Supplementary text only. A tooltip is invisible to touch users and to
   * anyone not hovering, so it must never carry the only copy of information
   * needed to operate the control.
   */
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className={styles.tooltip}
          side={side}
          sideOffset={6}
          collisionPadding={8}
        >
          {content}
          <TooltipPrimitive.Arrow className={styles.tooltipArrow} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
