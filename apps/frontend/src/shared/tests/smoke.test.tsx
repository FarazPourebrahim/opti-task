import { describe, expect, it } from 'vitest';
import { routes } from '@/App';
import { ROUTES } from '@/shared/routes/route.constants';
import { renderRoutes, screen } from './renderWithProviders';
import { server } from './server';
import { signedOut } from './session';

describe('app', () => {
  it('boots a signed-out visitor to the sign-in screen', async () => {
    // Arrange
    server.use(...signedOut());

    // Act
    renderRoutes(routes, { route: ROUTES.home });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Sign in to OptiTask' }),
    ).toBeVisible();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
