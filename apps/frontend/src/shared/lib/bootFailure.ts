/**
 * Renders a startup failure into the page without React.
 *
 * Config validation throws at module load, which is before React can mount, so
 * this is the one place the app writes to the DOM directly. It must stay
 * dependency-free: anything it imports could be the thing that failed.
 */
export function renderBootFailure(
  container: HTMLElement,
  error: unknown,
): void {
  const message =
    error instanceof Error ? error.message : 'Unknown startup error';

  const wrapper = document.createElement('pre');
  // textContent, never innerHTML — the message can echo env values.
  wrapper.textContent = `OptiTask failed to start.\n\n${message}`;
  wrapper.setAttribute('role', 'alert');
  wrapper.style.cssText =
    'margin:2rem;padding:1rem;white-space:pre-wrap;font-family:ui-monospace,monospace;';

  container.replaceChildren(wrapper);
}
