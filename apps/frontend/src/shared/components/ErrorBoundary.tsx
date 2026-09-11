import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Rendered in place of the subtree. Receives a reset to try again. */
  fallback: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Changing any value here resets the boundary — e.g. the current route. */
  resetKey?: unknown;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches render-time errors so one broken subtree cannot blank the app.
 *
 * A class component because `componentDidCatch` has no hook equivalent — this
 * is the one place the codebase is not a function component.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    // Without this, navigating away from a broken route leaves the fallback
    // on screen for the route the user just moved to.
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;

    if (error) {
      return this.props.fallback({ error, reset: this.reset });
    }

    return this.props.children;
  }
}
