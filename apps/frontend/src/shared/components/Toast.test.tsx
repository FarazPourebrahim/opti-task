import { Inbox } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { auditA11y } from '@/shared/tests/a11y';
import {
  render,
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';
import { Button } from './Button';
import { EmptyState, ErrorState } from './EmptyState';
import { LoadMore, SkeletonList } from './Skeleton';
import { useToast } from './Toast';

function ToastHarness() {
  const { toast } = useToast();
  return (
    <>
      <Button onClick={() => toast({ title: 'Task created' })}>Notify</Button>
      <Button
        onClick={() =>
          toast({
            title: 'Could not save',
            description: 'The server rejected the change.',
            tone: 'danger',
            requestId: 'req-42',
          })
        }
      >
        Fail
      </Button>
    </>
  );
}

describe('Toast', () => {
  it('shows a message when requested', async () => {
    const { user } = renderWithProviders(<ToastHarness />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));

    expect(await screen.findByText('Task created')).toBeVisible();
  });

  it('surfaces the request id so a user can quote it', async () => {
    const { user } = renderWithProviders(<ToastHarness />);

    await user.click(screen.getByRole('button', { name: 'Fail' }));

    // Radix renders a duplicate of each toast inside its aria-live region, so
    // the text legitimately appears twice.
    expect((await screen.findAllByText(/req-42/)).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('The server rejected the change.')[0],
    ).toBeVisible();
  });

  it('can be dismissed', async () => {
    const { user } = renderWithProviders(<ToastHarness />);
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await screen.findByText('Task created');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Task created')).toBeNull();
  });

  it('stacks multiple messages', async () => {
    const { user } = renderWithProviders(<ToastHarness />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.click(screen.getByRole('button', { name: 'Fail' }));

    expect(await screen.findByText('Task created')).toBeVisible();
    expect(screen.getByText('Could not save')).toBeVisible();
  });

  it('throws a useful error when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Orphan() {
      useToast();
      return null;
    }

    // Deliberately NOT renderWithProviders — that supplies the provider, which
    // would make this assertion vacuous.
    expect(() => render(<Orphan />)).toThrowError(/ToastProvider/);
    spy.mockRestore();
  });
});

describe('EmptyState', () => {
  it('renders an icon, a message and its next action', async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <EmptyState
        icon={<Inbox />}
        title="No tasks yet"
        description="Create the first task to get started."
        action={{ label: 'New task', onClick }}
      />,
    );

    expect(screen.getByText('No tasks yet')).toBeVisible();
    expect(screen.getByText('Create the first task to get started.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'New task' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <EmptyState icon={<Inbox />} title="Nothing here" />,
    );

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('ErrorState', () => {
  it('announces itself and offers a retry', async () => {
    const onRetry = vi.fn();
    const { user } = renderWithProviders(
      <ErrorState
        title="Could not load tasks"
        description="The request failed."
        requestId="req-7"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load tasks');
    expect(screen.getByText(/req-7/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('is announced, unlike an empty state', () => {
    // The distinction matters: an empty list is not an error and must not
    // interrupt a screen reader.
    const { rerender } = renderWithProviders(
      <ErrorState title="Failed" />,
    );
    expect(screen.queryByRole('alert')).not.toBeNull();

    rerender(<EmptyState icon={<Inbox />} title="Empty" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SkeletonList', () => {
  it('announces that something is loading', () => {
    renderWithProviders(<SkeletonList label="Loading tasks" />);

    expect(screen.getByRole('status', { name: 'Loading tasks' })).toBeVisible();
  });

  it('hides the individual placeholders from assistive technology', () => {
    const { container } = renderWithProviders(<SkeletonList count={2} />);

    const placeholders = container.querySelectorAll('[aria-hidden="true"]');
    expect(placeholders.length).toBeGreaterThan(0);
  });
});

describe('LoadMore', () => {
  it('renders nothing when the cursor is exhausted', () => {
    renderWithProviders(
      <LoadMore
        onLoadMore={vi.fn()}
        isLoading={false}
        hasMore={false}
        label="Load more"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('swaps the button for a spinner while loading, keeping the list intact', () => {
    renderWithProviders(
      <LoadMore onLoadMore={vi.fn()} isLoading hasMore label="Load more" />,
    );

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(screen.getByRole('status')).toBeVisible();
  });

  it('requests the next page on click', async () => {
    const onLoadMore = vi.fn();
    const { user } = renderWithProviders(
      <LoadMore
        onLoadMore={onLoadMore}
        isLoading={false}
        hasMore
        label="Load more"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
