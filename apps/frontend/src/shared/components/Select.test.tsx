import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { auditA11y } from '@/shared/tests/a11y';
import {
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';
import { Combobox } from './Combobox';
import { Field } from './Field';
import { Select } from './Select';
import { SegmentedControl, TabPanel, Tabs } from './Tabs';

const priorities = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

describe('Select', () => {
  function Harness() {
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <Field label="Priority">
        {(props) => (
          <Select
            {...props}
            value={value}
            onValueChange={setValue}
            options={priorities}
            placeholder="Choose a priority"
          />
        )}
      </Field>
    );
  }

  it('takes its accessible name from the Field label', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('combobox', { name: 'Priority' })).toBeVisible();
  });

  it('shows the placeholder until something is chosen', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Choose a priority');
  });

  it('opens and selects an option with the keyboard', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.tab();
    expect(screen.getByRole('combobox')).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: 'High' }));

    expect(screen.getByRole('combobox')).toHaveTextContent('High');
  });

  it('surfaces a Field error on the control', () => {
    renderWithProviders(
      <Field label="Priority" error="Pick one">
        {(props) => (
          <Select
            {...props}
            value={undefined}
            onValueChange={vi.fn()}
            options={priorities}
          />
        )}
      </Field>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Priority' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Pick one');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Harness />);

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('Combobox', () => {
  const people = [
    { value: 'u1', label: 'Dana Scully', description: 'Backend' },
    { value: 'u2', label: 'Fox Mulder', description: 'Frontend' },
    { value: 'u3', label: 'Walter Skinner', keywords: ['manager'] },
  ];

  function Harness() {
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <Field label="Assignee">
        {(props) => (
          <Combobox
            {...props}
            value={value}
            onValueChange={setValue}
            options={people}
            placeholder="Unassigned"
            searchPlaceholder="Search people"
            emptyMessage="No one matches that search"
          />
        )}
      </Field>
    );
  }

  it('opens a searchable list and selects a match', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Assignee' }));
    await user.type(await screen.findByPlaceholderText('Search people'), 'mul');
    await user.click(await screen.findByText('Fox Mulder'));

    expect(screen.getByRole('button', { name: 'Assignee' })).toHaveTextContent(
      'Fox Mulder',
    );
  });

  it('filters on keywords that are not shown in the label', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Assignee' }));
    await user.type(
      await screen.findByPlaceholderText('Search people'),
      'manager',
    );

    expect(await screen.findByText('Walter Skinner')).toBeVisible();
    expect(screen.queryByText('Dana Scully')).toBeNull();
  });

  it('shows a dedicated empty state when nothing matches', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Assignee' }));
    await user.type(
      await screen.findByPlaceholderText('Search people'),
      'zzzzz',
    );

    expect(
      await screen.findByText('No one matches that search'),
    ).toBeVisible();
  });
});

describe('Tabs', () => {
  function Harness() {
    const [value, setValue] = useState('board');
    return (
      <Tabs
        value={value}
        onValueChange={setValue}
        label="Project views"
        tabs={[
          { value: 'board', label: 'Board' },
          { value: 'list', label: 'List', badge: 12 },
        ]}
      >
        <TabPanel value="board">Board content</TabPanel>
        <TabPanel value="list">List content</TabPanel>
      </Tabs>
    );
  }

  it('shows only the active panel', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByText('Board content')).toBeVisible();
    expect(screen.queryByText('List content')).toBeNull();
  });

  it('switches panels with arrow keys', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('tab', { name: 'Board' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /List/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('List content')).toBeVisible();
  });

  it('names the tab list', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('tablist', { name: 'Project views' })).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Harness />);

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('SegmentedControl', () => {
  function Harness({ onChange = vi.fn() }: { onChange?: (v: string) => void }) {
    const [value, setValue] = useState('board');
    return (
      <SegmentedControl
        value={value}
        onValueChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        label="View mode"
        options={[
          { value: 'board', label: 'Board' },
          { value: 'list', label: 'List' },
        ]}
      />
    );
  }

  it('switches the active option', async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('radio', { name: 'List' }));

    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute(
      'data-state',
      'on',
    );
  });

  it('never deselects to an empty state', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);

    // Clicking the already-active option would clear a plain toggle group.
    await user.click(screen.getByRole('radio', { name: 'Board' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Board' })).toHaveAttribute(
      'data-state',
      'on',
    );
  });
});
