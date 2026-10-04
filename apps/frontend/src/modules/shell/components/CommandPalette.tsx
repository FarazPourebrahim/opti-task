import { Dialog, DialogContent, DialogTitle } from '@averoui/react';
import { Command } from 'cmdk';
import { LogOut, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSignOut } from '@/modules/auth/hooks/useSignOut';
import {
  ACCOUNT_NAV,
  PRIMARY_NAV,
} from '@/modules/shell/constants/shell.constants';

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const GROUP_CLASSES =
  '[&_[cmdk-group-heading]]:text-text-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold';

const ITEM_CLASSES =
  'data-[selected=true]:bg-primary-soft text-text-strong flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm';

/**
 * Keyboard-first navigation: every destination in the sidebar, plus sign-out,
 * reachable by typing. Entity search (projects, tasks) joins as those features
 * land — it needs their queries.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useSignOut();

  function goTo(path: string) {
    onOpenChange(false);
    void navigate(path);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        // No description: the title and the input's placeholder say it all.
        aria-describedby={undefined}
        className="overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">
          {t('shell.commandPalette.title')}
        </DialogTitle>
        <Command label={t('shell.commandPalette.title')}>
          <Command.Input
            placeholder={t('shell.commandPalette.placeholder')}
            className="border-border-subtle text-text-strong w-full border-b px-4 py-3.5 text-sm outline-none placeholder:text-gray-500"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="text-text-subtle flex flex-col items-center gap-2 py-8 text-sm">
              <SearchX aria-hidden className="size-6" />
              {t('shell.commandPalette.empty')}
            </Command.Empty>

            <Command.Group
              heading={t('shell.commandPalette.navigation')}
              className={GROUP_CLASSES}
            >
              {[...PRIMARY_NAV, ...ACCOUNT_NAV].map((item) => {
                const Icon = item.icon;

                return (
                  <Command.Item
                    key={item.to}
                    onSelect={() => goTo(item.to)}
                    className={ITEM_CLASSES}
                  >
                    <Icon aria-hidden className="size-4" />
                    {t(item.labelKey)}
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group
              heading={t('shell.commandPalette.actions')}
              className={GROUP_CLASSES}
            >
              <Command.Item
                onSelect={() => {
                  onOpenChange(false);
                  void signOut();
                }}
                className={ITEM_CLASSES}
              >
                <LogOut aria-hidden className="size-4" />
                {t('auth.signOut')}
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
