import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@averoui/react';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useOrganizationMemberActions } from '@/modules/organization/hooks/useOrganization';
import type { OrganizationMemberRow } from '@/modules/organization/hooks/useOrganization';
import { useOrganizationContext } from '@/modules/organization/hooks/useOrganizationContext';
import {
  ASSIGNABLE_ORG_ROLES,
  isAssignableOrgRole,
} from '@/modules/organization/schemas/organization.schema';
import { AppLink, LoadMore } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { can } from '@/shared/lib/capabilities';
import { userPath } from '@/shared/routes/route.constants';
import { formatRelativeTime } from '@/shared/utils/date.utils';

export function OrganizationMembersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const { user } = useAuth();
  const {
    organization,
    roles,
    members,
    membersTotal,
    hasMoreMembers,
    isLoadingMoreMembers,
    loadMoreMembers,
  } = useOrganizationContext();
  const { updateMemberRole, removeMember, isUpdatingRole } =
    useOrganizationMemberActions(organization.id);
  const [pendingRemoval, setPendingRemoval] =
    useState<OrganizationMemberRow | null>(null);

  const canManage = can(roles, 'organization:manage_members');

  async function handleRoleChange(member: OrganizationMemberRow, role: string) {
    if (!isAssignableOrgRole(role) || role === member.role) return;

    try {
      await updateMemberRole(member.user.id, role);
      toast({
        tone: 'success',
        title: t('organization.memberRoleUpdated', {
          name: member.user.name,
          role: t(`enums.orgRole.${role}`),
        }),
      });
    } catch (error) {
      // The cached role was never touched, so the select falls back to it.
      showError(error);
    }
  }

  /* Never rejects: ConfirmDialog stays open until this settles, and a failure
     is reported through the toast. */
  async function handleRemove() {
    if (!pendingRemoval) return;

    try {
      await removeMember(pendingRemoval);
      toast({
        tone: 'success',
        title: t('organization.memberRemoved', {
          name: pendingRemoval.user.name,
        }),
      });
    } catch (error) {
      showError(error);
    } finally {
      setPendingRemoval(null);
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <EmptyState variant="circle" icon={<Users />}>
          {t('organization.membersEmpty')}
        </EmptyState>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('organization.memberColumns.member')}</TableHead>
            <TableHead>{t('organization.memberColumns.role')}</TableHead>
            <TableHead>{t('organization.memberColumns.joined')}</TableHead>
            {canManage ? (
              <TableHead>
                <span className="sr-only">
                  {t('organization.memberColumns.actions')}
                </span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            // The owner's role and membership cannot be changed by anyone.
            const isOwner = member.role === 'OWNER';
            const isSelf = member.user.id === user?.id;

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <Avatar
                      name={member.user.name}
                      {...(member.user.avatarUrl
                        ? { src: member.user.avatarUrl }
                        : {})}
                    />
                    <span className="flex min-w-0 flex-col">
                      <AppLink
                        to={userPath(member.user.id)}
                        variant="subtle"
                        className="truncate font-medium"
                      >
                        {member.user.name}
                      </AppLink>
                      <span className="text-text-subtle truncate text-xs">
                        {member.user.email}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  {canManage && !isOwner ? (
                    <Select
                      value={member.role}
                      disabled={isUpdatingRole}
                      onValueChange={(role) =>
                        void handleRoleChange(member, role)
                      }
                    >
                      <SelectTrigger
                        aria-label={t('organization.memberRoleLabel', {
                          name: member.user.name,
                        })}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ORG_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(`enums.orgRole.${role}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge tone={isOwner ? 'primary' : 'neutral'}>
                      {t(`enums.orgRole.${member.role}`)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{formatRelativeTime(member.createdAt)}</TableCell>
                {canManage ? (
                  <TableCell>
                    {isOwner || isSelf ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingRemoval(member)}
                      >
                        {t('organization.memberRemove')}
                        <span className="sr-only"> {member.user.name}</span>
                      </Button>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <LoadMore
        shown={members.length}
        total={membersTotal}
        hasMore={hasMoreMembers}
        isLoading={isLoadingMoreMembers}
        onLoadMore={() => void loadMoreMembers()}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={t('organization.memberRemoveConfirmTitle', {
          name: pendingRemoval?.user.name ?? '',
        })}
        description={t('organization.memberRemoveConfirmBody', {
          name: pendingRemoval?.user.name ?? '',
          organization: organization.name,
        })}
        confirmLabel={t('organization.memberRemove')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleRemove}
      />
    </section>
  );
}
