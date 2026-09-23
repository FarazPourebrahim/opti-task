import { Laptop, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessions } from '@/modules/auth/hooks/useSessions';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonList,
  useToast,
} from '@/shared/components';
import { formatRelativeTime } from '@/shared/utils/date.utils';
import styles from './Sessions.page.module.css';

export function SessionsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { sessions, isLoading, error, isRevoking, revokeSession, refetch } =
    useSessions();
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

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
    <div className={styles.sessionsPage}>
      <Card>
        <CardHeader
          title={t('auth.sessions.title')}
          description={t('auth.sessions.subtitle')}
        />

        {isLoading ? (
          <SkeletonList count={3} label={t('common.loading')} />
        ) : error ? (
          <ErrorState
            title={t('auth.sessions.loadFailed')}
            description={t(error.messageKey as never)}
            {...(error.requestId ? { requestId: error.requestId } : {})}
            onRetry={() => void refetch()}
          />
        ) : (
          <ul className={styles.sessionList}>
            {sessions.map((session) => (
              <li key={session.id} className={styles.sessionRow}>
                <span className={styles.sessionIcon} aria-hidden>
                  {session.current ? <ShieldCheck /> : <Laptop />}
                </span>
                <div className={styles.sessionDetails}>
                  <p className={styles.sessionDevice}>
                    {session.userAgent ?? t('auth.sessions.unknownDevice')}
                    {session.current ? (
                      <Badge tone="success">{t('auth.sessions.current')}</Badge>
                    ) : null}
                  </p>
                  <p className={styles.sessionMeta}>
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
                <EmptyState
                  icon={<Laptop />}
                  title={t('auth.sessions.empty')}
                  size="sm"
                />
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
        isPending={isRevoking}
        destructive
        onConfirm={() => void handleRevoke()}
      />
    </div>
  );
}
