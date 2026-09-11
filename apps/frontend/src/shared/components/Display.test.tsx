import { describe, expect, it, vi } from 'vitest';
import { auditA11y } from '@/shared/tests/a11y';
import {
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';
import { Avatar, AvatarGroup } from './Avatar';
import { Badge, Chip, Kbd, ProgressBar } from './Badge';
import { Breadcrumbs, Card, CardHeader } from './Card';
import { Table } from './Table';
import type { Column } from './Table';

describe('Avatar', () => {
  it('falls back to initials when there is no image', () => {
    renderWithProviders(<Avatar name="Dana Scully" />);

    expect(screen.getByText('DS')).toBeVisible();
  });

  it('handles a single-word name', () => {
    renderWithProviders(<Avatar name="Skinner" />);

    expect(screen.getByText('S')).toBeVisible();
  });

  it('does not crash on an empty name', () => {
    renderWithProviders(<Avatar name="   " />);

    expect(screen.getByText('?')).toBeVisible();
  });
});

describe('AvatarGroup', () => {
  const people = [
    { id: '1', name: 'Dana Scully' },
    { id: '2', name: 'Fox Mulder' },
    { id: '3', name: 'Walter Skinner' },
    { id: '4', name: 'John Doggett' },
    { id: '5', name: 'Monica Reyes' },
  ];

  it('collapses the overflow into a count', () => {
    renderWithProviders(
      <AvatarGroup people={people} max={3} label="Watchers" />,
    );

    expect(screen.getByText('+2')).toBeVisible();
  });

  it('names the group', () => {
    renderWithProviders(<AvatarGroup people={people} label="Watchers" />);

    expect(screen.getByRole('group', { name: 'Watchers' })).toBeVisible();
  });

  it('shows no overflow chip when everyone fits', () => {
    renderWithProviders(
      <AvatarGroup people={people.slice(0, 2)} max={4} label="Watchers" />,
    );

    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});

describe('Badge', () => {
  it('always renders its label, so colour is never the only signal', () => {
    renderWithProviders(<Badge tone="danger">Blocked</Badge>);

    expect(screen.getByText('Blocked')).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <Badge tone="success">Done</Badge>,
    );

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('Chip', () => {
  it('exposes a named remove control', async () => {
    const onRemove = vi.fn();
    const { user } = renderWithProviders(
      <Chip onRemove={onRemove} removeLabel="Remove label backend">
        backend
      </Chip>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Remove label backend' }),
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders read-only without a remove control', () => {
    renderWithProviders(<Chip>backend</Chip>);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ProgressBar', () => {
  it('reports its value to assistive technology', () => {
    renderWithProviders(<ProgressBar value={42} label="Epic progress" />);

    const bar = screen.getByRole('progressbar', { name: 'Epic progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });

  it('clamps values outside 0–100', () => {
    const { rerender } = renderWithProviders(
      <ProgressBar value={-10} label="Progress" />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    );

    rerender(<ProgressBar value={250} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});

describe('Kbd', () => {
  it('renders as a keyboard element', () => {
    const { container } = renderWithProviders(<Kbd>Esc</Kbd>);

    expect(container.querySelector('kbd')).toHaveTextContent('Esc');
  });
});

describe('Card', () => {
  it('renders a heading and its actions', () => {
    renderWithProviders(
      <Card>
        <CardHeader
          title="Sprint 4"
          description="Ends Friday"
          actions={<button type="button">Edit</button>}
        />
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Sprint 4' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
  });
});

describe('Breadcrumbs', () => {
  const items = [
    { label: 'Acme', href: '/orgs/1' },
    { label: 'Web Platform', href: '/projects/2' },
    { label: 'Sprint 4' },
  ];

  it('marks the last crumb as the current page and not a link', () => {
    renderWithProviders(<Breadcrumbs items={items} label="Breadcrumb" />);

    expect(screen.getByText('Sprint 4')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Sprint 4' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Acme' })).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <Breadcrumbs items={items} label="Breadcrumb" />,
    );

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

type Row = { id: string; title: string; points: number };

describe('Table', () => {
  const rows: Row[] = [
    { id: '1', title: 'Build login', points: 5 },
    { id: '2', title: 'Fix header', points: 2 },
  ];

  const columns: Array<Column<Row>> = [
    { id: 'title', header: 'Title', cell: (row) => row.title, sortable: true },
    {
      id: 'points',
      header: 'Points',
      cell: (row) => row.points,
      align: 'end',
    },
  ];

  it('renders rows and a caption', () => {
    renderWithProviders(
      <Table
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Tasks in this sprint"
      />,
    );

    expect(
      screen.getByRole('table', { name: 'Tasks in this sprint' }),
    ).toBeVisible();
    expect(screen.getByText('Build login')).toBeVisible();
  });

  it('reports sort state through aria-sort, not just an arrow', async () => {
    const onSortChange = vi.fn();
    const { user } = renderWithProviders(
      <Table
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Tasks"
        sort={{ columnId: 'title', direction: 'ASC' }}
        onSortChange={onSortChange}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(screen.getByRole('button', { name: /Title/ }));
    expect(onSortChange).toHaveBeenCalledWith('title');
  });

  it('marks an unsorted sortable column as aria-sort="none"', () => {
    renderWithProviders(
      <Table
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Tasks"
        sort={{ columnId: 'points', direction: 'DESC' }}
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('renders the empty state instead of an empty body', () => {
    renderWithProviders(
      <Table
        rows={[]}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Tasks"
        emptyState={<p>No tasks match this filter</p>}
      />,
    );

    expect(screen.getByText('No tasks match this filter')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <Table
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Tasks"
        sort={{ columnId: 'title', direction: 'ASC' }}
        onSortChange={vi.fn()}
      />,
    );

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});
