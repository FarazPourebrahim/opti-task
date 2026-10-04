import type { ParseKeys } from 'i18next';

/**
 * What a route may carry in its `handle`.
 *
 * `crumb` is a translation key, so the breadcrumb trail is derived from the
 * route tree itself and a mistyped key is a compile error.
 */
export type RouteHandle = {
  crumb?: ParseKeys;
  /**
   * Lets the page name this crumb from loaded data (an organisation's name)
   * through `useBreadcrumbLabel`; `crumb` is what shows until it does.
   */
  crumbId?: string;
};

export function isRouteHandle(value: unknown): value is RouteHandle {
  return typeof value === 'object' && value !== null;
}
