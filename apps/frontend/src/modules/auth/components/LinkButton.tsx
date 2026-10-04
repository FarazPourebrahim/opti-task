import { Link } from '@averoui/react';
import type { ReactNode } from 'react';

type LinkButtonProps = {
  children: ReactNode;
  onClick?: (() => void) | undefined;
};

/**
 * An action that reads as a link.
 *
 * It is a `<button>`, not an `<a>`: until the router lands in Phase 5 these
 * navigate through callbacks and have no URL to point at.
 */
export function LinkButton({ children, onClick }: LinkButtonProps) {
  return (
    <Link asChild variant="prose">
      <button type="button" className="self-center text-sm" onClick={onClick}>
        {children}
      </button>
    </Link>
  );
}
