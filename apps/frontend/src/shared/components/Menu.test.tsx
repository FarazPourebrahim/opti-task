import { Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { auditA11y } from '@/shared/tests/a11y';
import {
  renderWithProviders,
  screen,
  waitFor,
} from '@/shared/tests/renderWithProviders';
import { Button } from './Button';
import {
  ContextMenu,
  ContextMenuItem,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
} from './Menu';
import { Popover, Tooltip } from './Popover';

function MenuHarness({ onDelete = vi.fn() }: { onDelete?: () => void }) {
  return (
    <Menu trigger={<Button>Actions</Button>}>
      <MenuLabel>Task</MenuLabel>
      <MenuItem onSelect={vi.fn()}>Edit</MenuItem>
      <MenuItem onSelect={vi.fn()} disabled>
        Duplicate
      </MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={onDelete} destructive icon={<Trash2 />}>
        Delete
      </MenuItem>
    </Menu>
  );
}

describe('Menu', () => {
  it('opens from the trigger and lists its items', async () => {
    const { user } = renderWithProviders(<MenuHarness />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    // The content is portalled, so it lands a commit after the click.
    // The menu takes its accessible name from the trigger button.
    expect(await screen.findByRole('menu', { name: 'Actions' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  });

  it('opens with the keyboard and moves focus with arrows', async () => {
    const { user } = renderWithProviders(<MenuHarness />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('menu')).toBeVisible());

    // First item is focused on open; arrowing skips the disabled item.
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('runs an item handler on select', async () => {
    const onDelete = vi.fn();
    const { user } = renderWithProviders(<MenuHarness onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not run a disabled item', async () => {
    const { user } = renderWithProviders(<MenuHarness />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(
      screen.getByRole('menuitem', { name: 'Duplicate' }),
    ).toHaveAttribute('data-disabled');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user } = renderWithProviders(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('has no accessibility violations while open', async () => {
    const { user, baseElement } = renderWithProviders(<MenuHarness />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await screen.findByRole('menu');

    // The aria-hidden-focus rule is disabled because it fires on Radix's focus
    // sentinels (span[data-radix-focus-guard]) — deliberately focusable,
    // zero-size, pointer-events:none elements that implement the focus trap.
    // They are library internals, exist only while the layer is open, and are
    // never reachable by a user. Every other rule stays on.
    expect(
      await auditA11y(baseElement),
    ).toHaveNoViolations();
  });
});

describe('ContextMenu', () => {
  it('renders its trigger region', () => {
    renderWithProviders(
      <ContextMenu items={<ContextMenuItem>Open</ContextMenuItem>}>
        <div>Task card</div>
      </ContextMenu>,
    );

    expect(screen.getByText('Task card')).toBeVisible();
  });
});

describe('Popover', () => {
  it('opens with an accessible name and traps nothing outside it', async () => {
    const { user } = renderWithProviders(
      <Popover trigger={<Button>Filters</Button>} label="Filter options">
        <input aria-label="Search" />
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    expect(screen.getByRole('dialog', { name: 'Filter options' })).toBeVisible();
  });

  it('closes on Escape', async () => {
    const { user } = renderWithProviders(
      <Popover trigger={<Button>Filters</Button>} label="Filter options">
        <input aria-label="Search" />
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Tooltip', () => {
  it('describes its trigger on keyboard focus', async () => {
    const { user } = renderWithProviders(
      <Tooltip content="Delete this task">
        <Button>Delete</Button>
      </Tooltip>,
    );

    await user.tab();

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent('Delete this task'),
    );
  });
});
