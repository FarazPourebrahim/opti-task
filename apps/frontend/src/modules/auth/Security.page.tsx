import { useTranslation } from 'react-i18next';
import { ChangePasswordForm } from '@/modules/auth/components/ChangePasswordForm';
import { PageHeader } from '@/shared/components';

export function SecurityPage() {
  const { t } = useTranslation();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader
        title={t('nav.security')}
        description={t('auth.security.subtitle')}
      />
      <ChangePasswordForm />
    </div>
  );
}
