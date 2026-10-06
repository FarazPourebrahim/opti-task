import { Alert, Button, Card, CardHeader, CardTitle } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserAnalyticsTable } from '@/modules/analytics/components/UserAnalyticsTable';
import { useUserAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import { ErrorState } from '@/shared/components';

type PersonAnalyticsProps = {
  userId: string;
  name: string;
};

/**
 * Another person's figures, asked for only when the viewer wants them.
 *
 * The server shows them to administrators of an organisation that person
 * belongs to, and the API does not say whether the viewer is one — so the
 * request is not made on sight. A refusal is explained in place; it is an
 * answer, not a failure of the page.
 */
export function PersonAnalytics({ userId, name }: PersonAnalyticsProps) {
  const { t } = useTranslation();
  const [isRequested, setIsRequested] = useState(false);
  const { analytics, isLoading, error, refetch } = useUserAnalytics(userId, {
    skip: !isRequested,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle as="h2">{t('analytics.user.title')}</CardTitle>
          <p className="text-text-subtle text-sm">
            {t('analytics.user.otherSubtitle')}
          </p>
        </div>
      </CardHeader>

      {analytics ? (
        <UserAnalyticsTable analytics={analytics} />
      ) : error?.kind === 'forbidden' ? (
        <Alert tone="info" title={t('analytics.user.forbiddenTitle')}>
          {t('analytics.user.forbiddenBody', { name })}
        </Alert>
      ) : error ? (
        <ErrorState
          title={t('analytics.user.loadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : (
        <div>
          <Button
            variant="outline"
            loading={isLoading}
            onClick={() => setIsRequested(true)}
          >
            {t('analytics.user.show')}
          </Button>
        </div>
      )}
    </Card>
  );
}
