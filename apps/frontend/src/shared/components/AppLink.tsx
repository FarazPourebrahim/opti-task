import { Link } from '@averoui/react';
import { Link as RouterLink } from 'react-router';
import type { LinkProps } from '@averoui/react';
import type { LinkProps as RouterLinkProps } from 'react-router';

type AppLinkProps = Omit<RouterLinkProps, 'className'> & {
  variant?: LinkProps['variant'];
  className?: string;
};

/**
 * An in-app text link: Avero's link styles on the router's client-side
 * navigation. A bare `<a href>` would reload the page and drop the Apollo
 * cache with it.
 */
export function AppLink({
  variant = 'prose',
  className,
  ...routerProps
}: AppLinkProps) {
  return (
    <Link asChild variant={variant} {...(className ? { className } : {})}>
      <RouterLink {...routerProps} />
    </Link>
  );
}
