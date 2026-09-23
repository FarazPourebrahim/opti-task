import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  fromApiDateTime,
  isApiDateTime,
  toApiDateTime,
} from '@/shared/utils/date.utils';
import {
  render,
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';
import { DatePicker } from './DatePicker';
import { ErrorBoundary } from './ErrorBoundary';
import { Field } from './Field';

describe('date conversion', () => {
  it('emits a full RFC-3339 instant, never a bare date', () => {
    const result = toApiDateTime(new Date(2026, 2, 1));

    // The API's DateTime scalar rejects '2026-03-01'.
    expect(result).toBe('2026-03-01T00:00:00.000Z');
    expect(isApiDateTime(result)).toBe(true);
  });

  it('pins the instant to UTC midnight regardless of local time of day', () => {
    const lateEvening = new Date(2026, 2, 1, 23, 45);
    const earlyMorning = new Date(2026, 2, 1, 0, 15);

    expect(toApiDateTime(lateEvening)).toBe(toApiDateTime(earlyMorning));
  });

  it('rejects a date-only string', () => {
    expect(isApiDateTime('2026-03-01')).toBe(false);
  });

  it('round-trips a value back to the same calendar day', () => {
    const iso = toApiDateTime(new Date(2026, 11, 25));
    const parsed = fromApiDateTime(iso);

    expect(parsed?.getUTCDate()).toBe(25);
    expect(parsed?.getUTCMonth()).toBe(11);
  });

  it('treats absent and malformed values as no date', () => {
    expect(fromApiDateTime(null)).toBeNull();
    expect(fromApiDateTime(undefined)).toBeNull();
    expect(fromApiDateTime('not a date')).toBeNull();
  });
});

describe('DatePicker', () => {
  function Harness({ initial = null }: { initial?: string | null }) {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <Field label="Due date">
        {(props) => (
          <DatePicker
            {...props}
            value={value}
            onValueChange={setValue}
            placeholder="No due date"
          />
        )}
      </Field>
    );
  }

  it('shows the placeholder when no date is set', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('button', { name: 'Due date' })).toHaveTextContent(
      'No due date',
    );
  });

  it('takes its name from the Field label', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('button', { name: 'Due date' })).toBeVisible();
  });

  it('renders an existing value as a formatted day', () => {
    renderWithProviders(<Harness initial="2026-03-01T00:00:00.000Z" />);

    expect(screen.getByRole('button', { name: 'Due date' })).toHaveTextContent(
      /Mar 1, 2026/,
    );
  });

  it('opens on the month of the selected date, not today', async () => {
    const { user } = renderWithProviders(
      <DatePicker
        value="2026-03-10T00:00:00.000Z"
        onValueChange={vi.fn()}
        placeholder="No due date"
        aria-label="Due date"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Due date' }));

    expect(await screen.findByText(/March 2026/)).toBeVisible();
  });

  it('picks a day and emits a full instant', async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithProviders(
      <DatePicker
        value="2026-03-10T00:00:00.000Z"
        onValueChange={onValueChange}
        placeholder="No due date"
        aria-label="Due date"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Due date' }));
    // react-day-picker gives each day button a descriptive aria-label
    // ("Sunday, March 15th…"), which is locale-dependent — match the visible
    // day number instead.
    await user.click(await screen.findByText('15'));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const emitted = onValueChange.mock.calls[0]?.[0] as string;
    expect(isApiDateTime(emitted)).toBe(true);
    expect(emitted).toBe('2026-03-15T00:00:00.000Z');
  });

  it('clears back to null', async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithProviders(
      <DatePicker
        value="2026-03-10T00:00:00.000Z"
        onValueChange={onValueChange}
        placeholder="No due date"
        aria-label="Due date"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});

describe('ErrorBoundary', () => {
  function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
    if (shouldThrow) throw new Error('render exploded');
    return <p>All good</p>;
  }

  it('renders the fallback instead of blanking the subtree', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={({ error }) => <p>Broke: {error.message}</p>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Broke: render exploded')).toBeVisible();
    spy.mockRestore();
  });

  it('reports the error to its handler', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary fallback={() => <p>Broke</p>} onError={onError}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('clears the fallback when the reset key changes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary resetKey="/a" fallback={() => <p>Broke</p>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Broke')).toBeVisible();

    // Navigating elsewhere must not leave the previous route's error on screen.
    rerender(
      <ErrorBoundary resetKey="/b" fallback={() => <p>Broke</p>}>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeVisible();
    spy.mockRestore();
  });

  it('passes children through when nothing throws', () => {
    render(
      <ErrorBoundary fallback={() => <p>Broke</p>}>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeVisible();
  });
});
