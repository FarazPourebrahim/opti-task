import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@averoui/react';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useSignOut } from '@/modules/auth/hooks/useSignOut';
import { ACCOUNT_NAV } from '@/modules/shell/constants/shell.constants';

export function UserMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { signOut, isPending } = useSignOut();

  // Rendered only inside the protected routes, but the session can end while
  // the shell is still on screen for a frame.
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('shell.userMenu')}
          className="focus-visible:ring-primary/40 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:outline-none"
        >
          <Avatar
            name={user.name}
            {...(user.avatarUrl ? { src: user.avatarUrl } : {})}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="text-text-strong block truncate text-sm font-semibold">
            {user.name}
          </span>
          <span className="text-text-subtle block truncate text-xs font-normal">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCOUNT_NAV.map((item) => {
          const Icon = item.icon;

          return (
            <DropdownMenuItem key={item.to} asChild>
              <RouterLink to={item.to}>
                <Icon aria-hidden className="size-4" />
                {t(item.labelKey)}
              </RouterLink>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          tone="danger"
          disabled={isPending}
          onSelect={() => void signOut()}
        >
          <LogOut aria-hidden className="size-4" />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
