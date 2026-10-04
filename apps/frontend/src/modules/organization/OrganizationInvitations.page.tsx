import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@averoui/react';
import { MailPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvitationStatus } from '@contracts';
import { InviteMemberForm } from '@/modules/organization/components/InviteMemberForm';
import { useOrganizationContext } from '@/modules/organization/hooks/useOrganizationContext';
import { useOrganizationInvitations } from '@/modules/organization/hooks/useOrganizationInvitations';
import type { InvitationRow } from '@/modules/organization/hooks/useOrganizationInvitations';
import type { InviteInput } from '@/modules/organization/schemas/organization.schema';
import { ErrorState, PageSkeleton } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { formatRelativeTime } from '@/shared/utils/date.utils';

const STATUS_TONES: Record<
  InvitationStatus,
  'amber' | 'success' | 'danger' | 'neutral'
> = {
  PENDING: 'amber',
  ACCEPTED: 'success',
  REVOKED: 'danger',
  EXPIRED: 'neutral',
};

export function OrganizationInvitationsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const { organization } = useOrganizationContext();
  const {
    invitations,
    isLoading,
    error,
    refetch,
    inviteMember,
    isInviting,
    revokeInvitation,
  } = useOrganizationInvitations(organization.id);
  const [pendingRevoke, setPendingRevoke] = useState<InvitationRow | null>(
    null,
  );

  // The tab is hidden from anyone who may not manage members, but the URL is
  // not: reaching it directly shows the Forbidden screen.
  useEscalateRouteError(error);

  async function handleInvite(input: InviteInput) {
    await inviteMember(input);
    toast({
      tone: 'success',
      title: t('organization.invited', { email: input.email }),
    });
  }

  async function handleRevoke() {
    if (!pendingRevoke) return;

    try {
      await revokeInvitation(pendingRevoke.id);
      toast({
        tone: 'success',
        title: t('organization.invitationRevoked', {
          email: pendingRevoke.email,
        }),
      });
    } catch (revokeError) {
      showError(revokeError);
    } finally {
      setPendingRevoke(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('organization.inviteTitle')}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4">
          {/* The API creates the invitation but delivers nothing: no email is
              sent and the link is never returned. Saying so beats a form that
              looks like it reached someone. */}
          <Alert tone="warning" title={t('organization.inviteNoticeTitle')}>
            {t('organization.inviteNoticeBody')}
          </Alert>
          <InviteMemberForm isPending={isInviting} onInvite={handleInvite} />
        </div>
      </Card>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('organization.invitationsLoadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : invitations.length === 0 ? (
        <Card>
          <EmptyState variant="circle" icon={<MailPlus />}>
            {t('organization.invitationsEmpty')}
          </EmptyState>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('organization.invitationColumns.email')}</TableHead>
              <TableHead>{t('organization.invitationColumns.role')}</TableHead>
              <TableHead>
                {t('organization.invitationColumns.status')}
              </TableHead>
              <TableHead>{t('organization.invitationColumns.sent')}</TableHead>
              <TableHead>
                <span className="sr-only">
                  {t('organization.invitationColumns.actions')}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="wrap-anywhere">
                  {invitation.email}
                </TableCell>
                <TableCell>{t(`enums.orgRole.${invitation.role}`)}</TableCell>
                <TableCell>
                  <Badge tone={STATUS_TONES[invitation.status]}>
                    {t(`enums.invitationStatus.${invitation.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatRelativeTime(invitation.createdAt)}
                </TableCell>
                <TableCell>
                  {/* Only an open invitation can be withdrawn. */}
                  {invitation.status === 'PENDING' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingRevoke(invitation)}
                    >
                      {t('organization.invitationRevoke')}
                      <span className="sr-only"> {invitation.email}</span>
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        title={t('organization.invitationRevokeConfirmTitle', {
          email: pendingRevoke?.email ?? '',
        })}
        description={t('organization.invitationRevokeConfirmBody')}
        confirmLabel={t('organization.invitationRevoke')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleRevoke}
      />
    </section>
  );
}
