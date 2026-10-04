import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  SkeletonText,
  useToast,
} from '@averoui/react';
import { Laptop, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessions } from '@/modules/auth/hooks/useSessions';
import { ErrorState } from '@/shared/components';
import { formatRelativeTime } from '@/shared/utils/date.utils';

export function SessionsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { sessions, isLoading, error, revokeSession, refetch } = useSessions();
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  /*
   * Never rejects: ConfirmDialog keeps itself open (and its confirm button
   * busy) until this settles, and a failure is reported through the toast.
   */
  async function handleRevoke() {
    if (!pendingRevoke) return;

    try {
      await revokeSession(pendingRevoke);
      toast({ title: t('auth.sessions.revoked'), tone: 'success' });
    } catch {
      toast({ title: t('error.unknown'), tone: 'danger' });
    } finally {
      setPendingRevoke(null);
    }
  }

  // Only other devices can be signed out from here; ending the current one is
  // what the sign-out control in the app shell does.
  const otherSessions = sessions.filter((session) => !session.current);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle as="h2">{t('auth.sessions.title')}</CardTitle>
            <p className="text-text-subtle text-sm">
              {t('auth.sessions.subtitle')}
            </p>
          </div>
        </CardHeader>

        {isLoading ? (
          // Skeletons are hidden from assistive technology, so the region
          // announces the loading state once on their behalf.
          <div role="status" aria-busy aria-label={t('common.loading')}>
            <SkeletonText lines={3} />
          </div>
        ) : error ? (
          <ErrorState
            title={t('auth.sessions.loadFailed')}
            description={t(error.messageKey as never)}
            requestId={error.requestId}
            onRetry={() => void refetch()}
          />
        ) : (
          <ul className="divide-border-subtle flex flex-col divide-y">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"
              >
                <span
                  aria-hidden
                  className="bg-surface-muted text-text-subtle inline-flex size-10 shrink-0 items-center justify-center rounded-full [&>svg]:size-5"
                >
                  {session.current ? <ShieldCheck /> : <Laptop />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-text-strong flex flex-wrap items-center gap-2 text-sm wrap-anywhere">
                    {session.userAgent ?? t('auth.sessions.unknownDevice')}
                    {session.current ? (
                      <Badge tone="success">{t('auth.sessions.current')}</Badge>
                    ) : null}
                  </p>
                  <p className="text-text-subtle text-xs wrap-anywhere">
                    {t('auth.sessions.signedInAt', {
                      when: formatRelativeTime(session.createdAt),
                    })}
                    {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                  </p>
                </div>
                {session.current ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingRevoke(session.id)}
                  >
                    {t('auth.sessions.revoke')}
                  </Button>
                )}
              </li>
            ))}

            {otherSessions.length === 0 ? (
              <li>
                <EmptyState variant="circle" icon={<Laptop />}>
                  {t('auth.sessions.empty')}
                </EmptyState>
              </li>
            ) : null}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        title={t('auth.sessions.revokeConfirmTitle')}
        description={t('auth.sessions.revokeConfirmBody')}
        confirmLabel={t('auth.sessions.revoke')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
