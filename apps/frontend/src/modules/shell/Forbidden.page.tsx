import { Button } from '@averoui/react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { StatusScreen } from '@/modules/shell/components/StatusScreen';
import { ROUTES } from '@/shared/routes/route.constants';

export function ForbiddenPage() {
  const { t } = useTranslation();

  return (
    <StatusScreen
      icon={<ShieldAlert />}
      title={t('status.forbiddenTitle')}
      description={t('status.forbiddenBody')}
      action={
        <Button asChild variant="outline">
          <RouterLink to={ROUTES.home}>{t('nav.backHome')}</RouterLink>
        </Button>
      }
    />
  );
}
