import { Input } from '@averoui/react';
import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorState, FormField } from '@/shared/components';
import { auditA11y } from '@/shared/tests/a11y';
import {
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';
import { graphql } from '@/shared/tests/graphql';
import { server } from '@/shared/tests/server';

const SIGNED_OUT = {
  errors: [{ message: 'no session', extensions: { code: 'UNAUTHENTICATED' } }],
  data: null,
};

// The provider tree bootstraps a session on mount; these components do not
// care who is signed in, so it settles as signed-out.
beforeEach(() => {
  server.use(
    graphql.query('CurrentUser', () => HttpResponse.json(SIGNED_OUT)),
    graphql.mutation('Refresh', () => HttpResponse.json(SIGNED_OUT)),
  );
});

describe('FormField', () => {
  it('labels its control and describes it with the hint', () => {
    // Arrange / Act
    renderWithProviders(
      <FormField label="Email" hint="We never share it.">
        <Input type="email" />
      </FormField>,
    );

    // Assert
    const control = screen.getByLabelText('Email');
    expect(control).toHaveAccessibleDescription('We never share it.');
    expect(control).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and announces the error', () => {
    // Arrange / Act
    renderWithProviders(
      <FormField label="Email" error="Enter a valid email address.">
        <Input type="email" />
      </FormField>,
    );

    // Assert
    const control = screen.getByLabelText('Email');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a valid email address.',
    );
  });

  it('disables the control when the field is disabled', () => {
    // Arrange / Act
    renderWithProviders(
      <FormField label="Email" disabled>
        <Input type="email" />
      </FormField>,
    );

    // Assert
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    const { container } = renderWithProviders(
      <FormField label="Email" hint="We never share it." error="Required.">
        <Input type="email" />
      </FormField>,
    );

    // Act / Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('ErrorState', () => {
  it('shows the cause, the request reference and a working retry', async () => {
    // Arrange
    const onRetry = vi.fn();
    const { user } = renderWithProviders(
      <ErrorState
        title="Could not load your sessions."
        description="Something went wrong on our end."
        requestId="req-123"
        onRetry={onRetry}
      />,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load your sessions.');
    expect(alert).toHaveTextContent('Something went wrong on our end.');
    expect(alert).toHaveTextContent('Reference: req-123');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers no retry when there is nothing to retry', () => {
    // Arrange / Act
    renderWithProviders(<ErrorState title="Could not load your sessions." />);

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    const { container } = renderWithProviders(
      <ErrorState
        title="Could not load."
        requestId="req-123"
        onRetry={vi.fn()}
      />,
    );

    // Act / Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});
