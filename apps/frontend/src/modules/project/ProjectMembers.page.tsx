import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROJECT_ROLES } from '@contracts';
import type { ProjectRole } from '@contracts';
import { AddProjectMemberForm } from '@/modules/project/components/AddProjectMemberForm';
import { useProjectMemberActions } from '@/modules/project/hooks/useProject';
import type { ProjectMemberRow } from '@/modules/project/hooks/useProject';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { AppLink, LoadMore } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { can } from '@/shared/lib/capabilities';
import { userPath } from '@/shared/routes/route.constants';
import { formatRelativeTime } from '@/shared/utils/date.utils';

function isProjectRole(value: string): value is ProjectRole {
  return (PROJECT_ROLES as readonly string[]).includes(value);
}

export function ProjectMembersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const {
    project,
    roles,
    members,
    membersTotal,
    hasMoreMembers,
    isLoadingMoreMembers,
    loadMoreMembers,
    organizationMembers,
  } = useProjectContext();
  const {
    addMember,
    isAdding,
    updateMemberRole,
    isUpdatingRole,
    removeMember,
  } = useProjectMemberActions(project.id);
  const [pendingRemoval, setPendingRemoval] = useState<ProjectMemberRow | null>(
    null,
  );

  const canManage = can(roles, 'project:manage_members');

  // People in the organisation who are not on the project yet.
  const candidates = useMemo(() => {
    const onProject = new Set(members.map((member) => member.user.id));
    return organizationMembers.filter((person) => !onProject.has(person.id));
  }, [members, organizationMembers]);

  async function handleAdd(candidate: MemberCandidate, role: ProjectRole) {
    await addMember(candidate.id, role);
    toast({
      tone: 'success',
      title: t('project.memberAdded', { name: candidate.name }),
    });
  }

  async function handleRoleChange(member: ProjectMemberRow, role: string) {
    if (!isProjectRole(role) || role === member.role) return;

    try {
      await updateMemberRole(member.user.id, role);
      toast({
        tone: 'success',
        title: t('project.memberRoleUpdated', {
          name: member.user.name,
          role: t(`enums.projectRole.${role}`),
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
        title: t('project.memberRemoved', { name: pendingRemoval.user.name }),
      });
    } catch (error) {
      showError(error);
    } finally {
      setPendingRemoval(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t('project.memberAddTitle')}</CardTitle>
          </CardHeader>
          <AddProjectMemberForm
            candidates={candidates}
            isPending={isAdding}
            onAdd={handleAdd}
          />
        </Card>
      ) : null}

      {members.length === 0 ? (
        <Card>
          <EmptyState variant="circle" icon={<Users />}>
            {t('project.membersEmpty')}
          </EmptyState>
        </Card>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('project.memberColumns.member')}</TableHead>
                <TableHead>{t('project.memberColumns.role')}</TableHead>
                <TableHead>{t('project.memberColumns.joined')}</TableHead>
                {canManage ? (
                  <TableHead>
                    <span className="sr-only">
                      {t('project.memberColumns.actions')}
                    </span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
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
                    {canManage ? (
                      <Select
                        value={member.role}
                        disabled={isUpdatingRole}
                        onValueChange={(role) =>
                          void handleRoleChange(member, role)
                        }
                      >
                        <SelectTrigger
                          aria-label={t('project.memberRoleLabel', {
                            name: member.user.name,
                          })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {t(`enums.projectRole.${role}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge>{t(`enums.projectRole.${member.role}`)}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatRelativeTime(member.createdAt)}</TableCell>
                  {canManage ? (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingRemoval(member)}
                      >
                        {t('project.memberRemove')}
                        <span className="sr-only"> {member.user.name}</span>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <LoadMore
            shown={members.length}
            total={membersTotal}
            hasMore={hasMoreMembers}
            isLoading={isLoadingMoreMembers}
            onLoadMore={() => void loadMoreMembers()}
          />
        </>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={t('project.memberRemoveConfirmTitle', {
          name: pendingRemoval?.user.name ?? '',
        })}
        description={t('project.memberRemoveConfirmBody', {
          name: pendingRemoval?.user.name ?? '',
          project: project.name,
        })}
        confirmLabel={t('project.memberRemove')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleRemove}
      />
    </section>
  );
}
