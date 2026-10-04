import { Button } from '@averoui/react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MobileNavigation } from '@/modules/shell/components/MobileNavigation';
import { UserMenu } from '@/modules/shell/components/UserMenu';
import { useBreadcrumbs } from '@/modules/shell/hooks/useBreadcrumbs';
import { Breadcrumbs } from '@/shared/components';

type TopbarProps = {
  onOpenCommandPalette: () => void;
};

export function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const { t } = useTranslation();
  const breadcrumbs = useBreadcrumbs();

  return (
    <header className="border-border-subtle bg-surface sticky top-0 z-(--z-sticky) flex h-16 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
      <MobileNavigation />

      <div className="min-w-0 flex-1">
        {/* A trail of one is just the page's own name, which its heading says. */}
        {breadcrumbs.length > 1 ? (
          <Breadcrumbs label={t('nav.breadcrumbs')} items={breadcrumbs} />
        ) : null}
      </div>

      <Button
        variant="outline"
        size="sm"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={onOpenCommandPalette}
      >
        <Search aria-hidden className="size-4" />
        {t('shell.search')}
      </Button>

      <UserMenu />
    </header>
  );
}
