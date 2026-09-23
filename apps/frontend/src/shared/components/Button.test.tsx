import { describe, expect, it, vi } from 'vitest';
import { auditA11y } from '@/shared/tests/a11y';
import { renderWithProviders, screen } from '@/shared/tests/renderWithProviders';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Spinner } from './Spinner';

describe('Button', () => {
  it('renders as a button and fires its handler', async () => {
    // Arrange
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <Button onClick={onClick}>Create task</Button>,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    // Assert
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    renderWithProviders(<Button>Save</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('disables and marks itself busy while loading', () => {
    renderWithProviders(<Button isLoading>Saving</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('cannot be activated while loading', async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <Button isLoading onClick={onClick}>
        Saving
      </Button>,
    );

    await user.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('hides decorative icons from assistive technology', () => {
    renderWithProviders(
      <Button startIcon={<svg data-testid="icon" />}>Add</Button>,
    );

    expect(screen.getByTestId('icon').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('renders the child element when asChild is set', () => {
    renderWithProviders(
      <Button asChild>
        <a href="/projects">Projects</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Projects' })).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is keyboard operable', async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(<Button onClick={onClick}>Go</Button>);

    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it.each(['primary', 'secondary', 'ghost', 'danger', 'subtle'] as const)(
    'has no accessibility violations as the %s variant',
    async (variant) => {
      const { container } = renderWithProviders(
        <Button variant={variant}>Action</Button>,
      );

      expect(await auditA11y(container)).toHaveNoViolations();
    },
  );
});

describe('IconButton', () => {
  it('exposes its label as the accessible name', () => {
    renderWithProviders(
      <IconButton label="Delete task" icon={<svg />} />,
    );

    expect(screen.getByRole('button', { name: 'Delete task' })).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <IconButton label="Close" icon={<svg />} />,
    );

    expect(await auditA11y(container)).toHaveNoViolations();
  });

  it('swaps the icon for a spinner while loading', () => {
    renderWithProviders(
      <IconButton label="Refresh" icon={<svg data-testid="icon" />} isLoading />,
    );

    expect(screen.queryByTestId('icon')).toBeNull();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Spinner', () => {
  it('announces itself when given a label', () => {
    renderWithProviders(<Spinner label="Loading tasks" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading tasks');
  });

  it('stays silent when purely decorative', () => {
    const { container } = renderWithProviders(<Spinner />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
