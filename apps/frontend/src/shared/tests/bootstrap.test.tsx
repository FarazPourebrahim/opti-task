import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/shared/config';
import { renderBootFailure } from '@/shared/lib/bootFailure';

/**
 * The boot-failure contract: a missing or malformed `.env` must surface a
 * readable message, not a blank page. `main.tsx` catches the config throw and
 * hands it to `renderBootFailure`; both halves are asserted here.
 */
describe('boot failure', () => {
  it('produces a message naming the offending variable and the fix', () => {
    // Arrange / Act
    let thrown: unknown;
    try {
      parseEnv({ VITE_WS_URL: 'ws://localhost:4000/graphql' });
    } catch (error) {
      thrown = error;
    }

    // Assert
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('VITE_API_URL');
    expect((thrown as Error).message).toContain('.env.example');
  });

  it('renders the config error where the app would have been', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    try {
      parseEnv({});
    } catch (error) {
      renderBootFailure(container, error);
    }

    // Assert — the developer sees the cause, not an empty page.
    expect(container.textContent).toContain('OptiTask failed to start.');
    expect(container.textContent).toContain('VITE_API_URL');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('escapes the message rather than injecting it as markup', () => {
    // Arrange
    const container = document.createElement('div');
    const hostile = new Error('<img src=x onerror="alert(1)">');

    // Act
    renderBootFailure(container, hostile);

    // Assert
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
  });

  it('handles a thrown non-Error without rendering "undefined"', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderBootFailure(container, 'a string was thrown');

    // Assert
    expect(container.textContent).toContain('Unknown startup error');
    expect(container.textContent).not.toContain('undefined');
  });
});
