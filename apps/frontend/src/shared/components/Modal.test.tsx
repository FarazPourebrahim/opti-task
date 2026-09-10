import { axe } from 'jest-axe';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  renderWithProviders,
  screen,
  waitFor,
} from '@/shared/tests/renderWithProviders';
import { Button } from './Button';
import { ConfirmDialog, Drawer, Modal } from './Modal';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Edit task"
        description="Change the task details."
        footer={<Button>Save</Button>}
      >
        <input aria-label="Task title" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('opens from its trigger and exposes an accessible name', async () => {
    const { user } = renderWithProviders(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  });

  it('traps focus inside the dialog while open', async () => {
    const { user } = renderWithProviders(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const dialog = screen.getByRole('dialog');

    // Tab several times; focus must never escape the dialog.
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user } = renderWithProviders(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open modal' });

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeVisible();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    // Radix restores focus during unmount cleanup, which lands a tick later.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes from the close button', async () => {
    const { user } = renderWithProviders(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the title for assistive tech even when hidden visually', async () => {
    function Harness() {
      return (
        <Modal open onOpenChange={vi.fn()} title="Quick search" hideTitle>
          <input aria-label="Query" />
        </Modal>
      );
    }

    renderWithProviders(<Harness />);

    expect(screen.getByRole('dialog', { name: 'Quick search' })).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { user, baseElement } = renderWithProviders(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});

describe('Drawer', () => {
  it('renders as a labelled dialog', () => {
    renderWithProviders(
      <Drawer open onOpenChange={vi.fn()} title="Filters">
        <p>Body</p>
      </Drawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeVisible();
  });
});

describe('ConfirmDialog', () => {
  it('announces itself as an alertdialog naming the target', () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete project"
        description='This permanently deletes "Web Platform" and its tasks.'
        confirmLabel="Delete project"
        destructive
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Delete project' });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent('Web Platform');
  });

  it('runs the confirm handler only when confirmed', async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Remove member"
        description="Remove Dana from this project."
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables both actions while the confirmation is pending', () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete task"
        description="This cannot be undone."
        confirmLabel="Delete"
        isPending
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
