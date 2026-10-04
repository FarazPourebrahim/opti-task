import { Card, EmptyState } from '@averoui/react';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { PageHeader } from '@/shared/components';

/**
 * The signed-in landing screen.
 *
 * It shows only what the session already knows. The organisation list that
 * belongs here arrives with Phase 6 and replaces the summary below.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('home.greeting', { name: user.name })}
        description={t('home.subtitle')}
      />

      <Card>
        {user.organizationCount === 0 ? (
          <EmptyState variant="circle" icon={<Building2 />}>
            {t('home.noOrganizations')}
          </EmptyState>
        ) : (
          <p className="text-text-strong flex items-center gap-3 text-sm">
            <Building2
              aria-hidden
              className="text-text-subtle size-5 shrink-0"
            />
            {t('home.organizations', { count: user.organizationCount })}
          </p>
        )}
      </Card>
    </div>
  );
}
