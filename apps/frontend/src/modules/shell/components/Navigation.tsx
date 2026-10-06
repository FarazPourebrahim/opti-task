import { SidebarNav, SidebarNavItem } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useMatch } from 'react-router';
import {
  ACCOUNT_NAV,
  PRIMARY_NAV,
} from '@/modules/shell/constants/shell.constants';
import type { NavItem } from '@/modules/shell/constants/shell.constants';

type NavigationProps = {
  /** Called after a destination is chosen — the mobile drawer closes on it. */
  onNavigate?: (() => void) | undefined;
};

type NavigationItemProps = NavigationProps & {
  item: NavItem;
};

function NavigationItem({ item, onNavigate }: NavigationItemProps) {
  const { t } = useTranslation();
  const match = useMatch({ path: item.to, end: item.end ?? false });
  const Icon = item.icon;

  return (
    <SidebarNavItem asChild current={match !== null} className="py-2.5">
      <RouterLink to={item.to} onClick={onNavigate}>
        <Icon aria-hidden className="size-5 shrink-0" />
        <span>{t(item.labelKey)}</span>
      </RouterLink>
    </SidebarNavItem>
  );
}

/** The app's destinations, shared by the desktop sidebar and the mobile drawer. */
export function Navigation({ onNavigate }: NavigationProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <SidebarNav aria-label={t('nav.primary')}>
        {PRIMARY_NAV.map((item) => (
          <NavigationItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </SidebarNav>

      <div className="flex flex-col gap-2">
        <p
          aria-hidden
          className="text-text-subtle px-3 text-xs font-semibold tracking-wide uppercase"
        >
          {t('nav.account')}
        </p>
        <SidebarNav aria-label={t('nav.account')}>
          {ACCOUNT_NAV.map((item) => (
            <NavigationItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </SidebarNav>
      </div>
    </div>
  );
}
