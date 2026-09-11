import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

export type TabItem = {
  value: string;
  label: ReactNode;
  /** Count or status shown beside the label. */
  badge?: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  tabs: readonly TabItem[];
  /** Names the tab list for assistive technology. */
  label: string;
  children: ReactNode;
};

/**
 * Tabs with automatic activation: arrow keys move focus and switch panels in
 * one step, which is the expected behaviour when panels are cheap to render.
 */
export function Tabs({
  value,
  onValueChange,
  tabs,
  label,
  children,
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      className={styles.tabs}
      value={value}
      onValueChange={onValueChange}
    >
      <TabsPrimitive.List className={styles.tabsList} aria-label={label}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled ?? false}
            className={styles.tabsTrigger}
          >
            <span className={styles.tabsTriggerLabel}>{tab.label}</span>
            {tab.badge === undefined ? null : (
              <span className={styles.tabsTriggerBadge}>{tab.badge}</span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabPanel({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Content className={styles.tabsPanel} value={value}>
      {children}
    </TabsPrimitive.Content>
  );
}

export type SegmentedOption = {
  value: string;
  label: ReactNode;
  /** Required when the label is an icon, so the control keeps a name. */
  ariaLabel?: string;
};

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SegmentedOption[];
  label: string;
  size?: 'sm' | 'md';
};

/**
 * A compact one-of-many switch for view modes (board/list, light/dark).
 *
 * Uses a single-select toggle group rather than tabs: it changes *how* the same
 * content is shown, and controls no tabpanel.
 */
export function SegmentedControl({
  value,
  onValueChange,
  options,
  label,
  size = 'md',
}: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      className={styles.segmented}
      data-size={size}
      value={value}
      // A toggle group allows deselection; a segmented control must always have
      // exactly one active option, so an empty value is ignored.
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      aria-label={label}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={styles.segmentedOption}
          {...(option.ariaLabel ? { 'aria-label': option.ariaLabel } : {})}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
