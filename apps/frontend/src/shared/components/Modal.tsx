import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import styles from './Modal.module.css';

/**
 * Restores focus to whatever opened the dialog.
 *
 * Radix returns focus to `Dialog.Trigger` specifically. These dialogs are
 * controlled by `open`/`onOpenChange` and have no `Trigger`, so Radix finds a
 * null ref and focus falls to `<body>` — dropping a keyboard user at the top of
 * the page on every close (WCAG 2.4.3). Capturing the opener at open time and
 * restoring it on close fixes that.
 *
 * `onOpenAutoFocus` fires before the focus scope moves focus in, so
 * `document.activeElement` is still the opener at that moment.
 */
function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: (): void => {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    },
    onCloseAutoFocus: (event: Event): void => {
      // Pre-empts Radix's own restore, which would target the absent trigger.
      event.preventDefault();
      opener.current?.focus();
    },
  };
}

/*
 * Overlay surfaces, all on Radix Dialog: focus is trapped while open, Escape
 * and outside-click close, focus returns to the trigger, and the rest of the
 * page is inert to assistive technology.
 *
 * `title` is required rather than optional — a dialog with no accessible name
 * is announced as an unlabelled group, so the type system refuses to build one.
 */

type ModalSize = 'sm' | 'md' | 'lg';

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Hides the title visually while keeping it for assistive technology. */
  hideTitle?: boolean;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  size = 'md',
  footer,
  children,
}: ModalProps) {
  const { t } = useTranslation();
  const returnFocus = useReturnFocus();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.modal}
          data-size={size}
          onOpenAutoFocus={returnFocus.onOpenAutoFocus}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        >
          <header className={styles.modalHeader}>
            {hideTitle ? (
              <VisuallyHidden asChild>
                <Dialog.Title>{title}</Dialog.Title>
              </VisuallyHidden>
            ) : (
              <Dialog.Title className={styles.modalTitle}>{title}</Dialog.Title>
            )}
            <Dialog.Close asChild>
              <IconButton label={t('common.close')} icon={<X />} size="sm" />
            </Dialog.Close>
          </header>
          {description ? (
            <Dialog.Description className={styles.modalDescription}>
              {description}
            </Dialog.Description>
          ) : null}
          <div className={styles.modalBody}>{children}</div>
          {footer ? <footer className={styles.modalFooter}>{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type DrawerProps = Omit<ModalProps, 'size'> & {
  side?: 'left' | 'right';
};

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  side = 'right',
  footer,
  children,
}: DrawerProps) {
  const { t } = useTranslation();
  const returnFocus = useReturnFocus();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.drawer}
          data-side={side}
          onOpenAutoFocus={returnFocus.onOpenAutoFocus}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        >
          <header className={styles.modalHeader}>
            {hideTitle ? (
              <VisuallyHidden asChild>
                <Dialog.Title>{title}</Dialog.Title>
              </VisuallyHidden>
            ) : (
              <Dialog.Title className={styles.modalTitle}>{title}</Dialog.Title>
            )}
            <Dialog.Close asChild>
              <IconButton label={t('common.close')} icon={<X />} size="sm" />
            </Dialog.Close>
          </header>
          {description ? (
            <Dialog.Description className={styles.modalDescription}>
              {description}
            </Dialog.Description>
          ) : null}
          <div className={styles.modalBody}>{children}</div>
          {footer ? <footer className={styles.modalFooter}>{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Say what will happen and to what — name the target explicitly. */
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Use for irreversible actions; renders the confirm button as danger. */
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const returnFocus = useReturnFocus();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.modal}
          data-size="sm"
          role="alertdialog"
          onOpenAutoFocus={returnFocus.onOpenAutoFocus}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        >
          <header className={styles.modalHeader}>
            <Dialog.Title className={styles.modalTitle}>{title}</Dialog.Title>
          </header>
          <Dialog.Description className={styles.modalDescription}>
            {description}
          </Dialog.Description>
          <footer className={styles.modalFooter}>
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={isPending}>
                {cancelLabel ?? t('common.cancel')}
              </Button>
            </Dialog.Close>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              onClick={onConfirm}
              isLoading={isPending}
            >
              {confirmLabel}
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
