import { axe } from 'jest-axe';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';
import { Field } from './Field';
import { Input, Textarea } from './Input';
import { Checkbox, RadioGroup, Switch } from './Toggle';

describe('Field', () => {
  it('associates its label with the control', () => {
    renderWithProviders(
      <Field label="Task title">{(props) => <Input {...props} />}</Field>,
    );

    expect(screen.getByLabelText('Task title')).toBeVisible();
  });

  it('links the hint to the control via aria-describedby', () => {
    renderWithProviders(
      <Field label="Story points" hint="Fibonacci only">
        {(props) => <Input {...props} />}
      </Field>,
    );

    expect(screen.getByLabelText('Story points')).toHaveAccessibleDescription(
      'Fibonacci only',
    );
  });

  it('marks the control invalid and announces the error', () => {
    renderWithProviders(
      <Field label="Email" error="Enter a valid email">
        {(props) => <Input {...props} />}
      </Field>,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
    expect(input).toHaveAccessibleDescription('Enter a valid email');
  });

  it('describes the control with hint and error together', () => {
    renderWithProviders(
      <Field label="Password" hint="At least 8 characters" error="Too short">
        {(props) => <Input {...props} />}
      </Field>,
    );

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'At least 8 characters Too short',
    );
  });

  it('is not invalid when no error is given', () => {
    renderWithProviders(
      <Field label="Notes">{(props) => <Textarea {...props} />}</Field>,
    );

    expect(screen.getByLabelText('Notes')).not.toHaveAttribute('aria-invalid');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <Field label="Title" hint="Keep it short" error="Required">
        {(props) => <Input {...props} />}
      </Field>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Input', () => {
  it('accepts typed text', async () => {
    const { user } = renderWithProviders(
      <Field label="Title">{(props) => <Input {...props} />}</Field>,
    );

    await user.type(screen.getByLabelText('Title'), 'Build login');

    expect(screen.getByLabelText('Title')).toHaveValue('Build login');
  });

  it('does not accept input while disabled', async () => {
    const { user } = renderWithProviders(
      <Field label="Title">{(props) => <Input {...props} disabled />}</Field>,
    );

    await user.type(screen.getByLabelText('Title'), 'nope');

    expect(screen.getByLabelText('Title')).toHaveValue('');
  });
});

function CheckboxHarness({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState<boolean | 'indeterminate'>(initial);
  return (
    <Checkbox checked={checked} onCheckedChange={setChecked} label="Watch task" />
  );
}

describe('Checkbox', () => {
  it('toggles by click and by keyboard', async () => {
    const { user } = renderWithProviders(<CheckboxHarness />);
    const box = screen.getByRole('checkbox', { name: 'Watch task' });

    await user.click(box);
    expect(box).toBeChecked();

    await user.keyboard(' ');
    expect(box).not.toBeChecked();
  });

  it('exposes the indeterminate state to assistive technology', () => {
    renderWithProviders(
      <Checkbox
        checked="indeterminate"
        onCheckedChange={vi.fn()}
        label="Select all"
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<CheckboxHarness />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Switch', () => {
  it('toggles and reports its state', async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} label="Email me" />;
    }

    const { user } = renderWithProviders(<Harness />);
    const control = screen.getByRole('switch', { name: 'Email me' });

    expect(control).not.toBeChecked();
    await user.click(control);
    expect(control).toBeChecked();
  });
});

describe('RadioGroup', () => {
  const options = [
    { value: 'low', label: 'Low' },
    { value: 'high', label: 'High' },
  ];

  it('selects an option with arrow keys', async () => {
    function Harness() {
      const [value, setValue] = useState<string | undefined>('low');
      return (
        <RadioGroup
          value={value}
          onValueChange={setValue}
          options={options}
          label="Priority"
        />
      );
    }

    const { user } = renderWithProviders(<Harness />);

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Low' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
  });

  it('does not select on a pointer-driven focus after an arrow press', async () => {
    // Guards the capture-phase arrow flag: an arrow key pressed elsewhere must
    // not make the next click-focus select a different option.
    const onValueChange = vi.fn();
    const { user } = renderWithProviders(
      <>
        <input aria-label="Elsewhere" />
        <RadioGroup
          value="low"
          onValueChange={onValueChange}
          options={options}
          label="Priority"
        />
      </>,
    );

    await user.click(screen.getByLabelText('Elsewhere'));
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('radio', { name: 'High' }));

    // Exactly one change, from the click itself — not two.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('high');
  });

  it('names the group for assistive technology', () => {
    renderWithProviders(
      <RadioGroup
        value="low"
        onValueChange={vi.fn()}
        options={options}
        label="Priority"
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Priority' })).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <RadioGroup
        value="low"
        onValueChange={vi.fn()}
        options={options}
        label="Priority"
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
