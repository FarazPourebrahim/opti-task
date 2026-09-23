import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { renderWithProviders, screen } from './renderWithProviders';

describe('app shell', () => {
  it('mounts and renders its root landmark', () => {
    // Arrange / Act
    renderWithProviders(<App />);

    // Assert
    expect(screen.getByRole('heading', { name: 'OptiTask' })).toBeVisible();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
