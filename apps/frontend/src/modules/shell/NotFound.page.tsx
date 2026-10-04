import { Button } from '@averoui/react';
import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { StatusScreen } from '@/modules/shell/components/StatusScreen';
import { ROUTES } from '@/shared/routes/route.constants';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <StatusScreen
      icon={<Compass />}
      title={t('status.notFoundTitle')}
      description={t('status.notFoundBody')}
      action={
        <Button asChild variant="outline">
          <RouterLink to={ROUTES.home}>{t('nav.backHome')}</RouterLink>
        </Button>
      }
    />
  );
}
