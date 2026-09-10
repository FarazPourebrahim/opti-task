import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderBootFailure } from '@/shared/lib/bootFailure';

/**
 * Application bootstrap.
 *
 * The config module throws at load time when `.env` is missing or malformed.
 * A static import would make that throw before this file's body runs, leaving
 * a blank page — exactly the "silently broken app" the fail-fast loader exists
 * to prevent. Dynamic imports keep the failure catchable so it can be shown.
 */
async function bootstrap(container: HTMLElement): Promise<void> {
  try {
    await import('@/shared/config');
    const { App } = await import('@/App');

    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    renderBootFailure(container, error);
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root is missing from index.html');
}

void bootstrap(rootElement);
