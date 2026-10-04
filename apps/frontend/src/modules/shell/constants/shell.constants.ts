import { House, KeyRound, MonitorSmartphone } from 'lucide-react';
import type { ParseKeys } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/routes/route.constants';

export type NavItem = {
  to: string;
  labelKey: ParseKeys;
  icon: LucideIcon;
  /** Match the path exactly, for a destination that prefixes every other. */
  end?: boolean;
};

/*
 * One list feeds the sidebar, the mobile drawer, the account menu and the
 * command palette, so a destination added here is reachable from all four.
 * Feature phases append to these as their screens land.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: ROUTES.home, labelKey: 'nav.home', icon: House, end: true },
];

export const ACCOUNT_NAV: readonly NavItem[] = [
  {
    to: ROUTES.accountSessions,
    labelKey: 'nav.sessions',
    icon: MonitorSmartphone,
  },
  { to: ROUTES.accountSecurity, labelKey: 'nav.security', icon: KeyRound },
];

/** The skip link's target and the `main` landmark's id. */
export const MAIN_CONTENT_ID = 'main-content';
