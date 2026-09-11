/**
 * The shared component library.
 *
 * Features import from here, never from a component file directly — so a
 * primitive can be restructured without touching every call site. If a feature
 * needs something that is not exported here, the answer is to add it here, not
 * to rebuild it locally.
 */

export { Avatar, AvatarGroup } from './Avatar';
export { Badge, Chip, Kbd, ProgressBar } from './Badge';
export type { BadgeTone } from './Badge';
export { Button } from './Button';
export type { ButtonSize, ButtonVariant } from './Button';
export { Breadcrumbs, Card, CardHeader } from './Card';
export type { BreadcrumbItem } from './Card';
export { Combobox } from './Combobox';
export type { ComboboxOption } from './Combobox';
export { DatePicker } from './DatePicker';
export { EmptyState, ErrorState } from './EmptyState';
export { ErrorBoundary } from './ErrorBoundary';
export { Field } from './Field';
export { IconButton } from './IconButton';
export { Input, Textarea } from './Input';
export {
  ContextMenu,
  ContextMenuItem,
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuLabel,
  MenuSeparator,
} from './Menu';
export { ConfirmDialog, Drawer, Modal } from './Modal';
export { Popover, Tooltip, TooltipProvider } from './Popover';
export { Select } from './Select';
export type { SelectOption } from './Select';
export { LoadMore, Skeleton, SkeletonList } from './Skeleton';
export { Spinner } from './Spinner';
export { SegmentedControl, TabPanel, Tabs } from './Tabs';
export type { SegmentedOption, TabItem } from './Tabs';
export { Table } from './Table';
export type { Column, SortDirection } from './Table';
export { ToastProvider, useToast } from './Toast';
export type { ToastOptions, ToastTone } from './Toast';
export { Checkbox, RadioGroup, Switch } from './Toggle';
export type { RadioOption } from './Toggle';
