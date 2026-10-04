import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@averoui/react';
import { UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { AvailabilityStatus } from '@contracts';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { TeamForm } from '@/modules/team/components/TeamForm';
import { TeamMemberForm } from '@/modules/team/components/TeamMemberForm';
import {
  useTeam,
  useTeamActions,
  useTeamMemberActions,
} from '@/modules/team/hooks/useTeam';
import type { TeamMemberRow } from '@/modules/team/hooks/useTeam';
import type {
  TeamInput,
  TeamMemberInput,
} from '@/modules/team/schemas/team.schema';
import { resolveTeamRoles } from '@/modules/team/utils/team.utils';
import { AppLink, ErrorState, PageSkeleton } from '@/shared/components';
import { useBreadcrumbLabel } from '@/shared/context/breadcrumb.context';
import { useEntityIdParam } from '@/shared/hooks/useEntityIdParam';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { can } from '@/shared/lib/capabilities';
import {
  CRUMB_IDS,
  ROUTE_PARAMS,
  projectTeamsPath,
  userPath,
} from '@/shared/routes/route.constants';

const AVAILABILITY_TONES: Record<
  AvailabilityStatus,
  'success' | 'amber' | 'neutral'
> = {
  AVAILABLE: 'success',
  BUSY: 'amber',
  AWAY: 'neutral',
  OFFLINE: 'neutral',
};

export function TeamPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, roles: projectRoles, members } = useProjectContext();
  const teamId = useEntityIdParam(ROUTE_PARAMS.teamId);
  const { team, isLoading, error, refetch } = useTeam(teamId);
  const { updateTeam, isUpdating, deleteTeam } = useTeamActions(teamId);
  const {
    addMember,
    isAdding,
    updateMember,
    isUpdating: isUpdatingMember,
    removeMember,
  } = useTeamMemberActions(teamId);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberRow | null>(
    null,
  );
  const [pendingRemoval, setPendingRemoval] = useState<TeamMemberRow | null>(
    null,
  );

  useEscalateRouteError(error);
  useBreadcrumbLabel(CRUMB_IDS.team, team?.name);

  const roles = useMemo(
    () => resolveTeamRoles(user?.id, projectRoles, team?.members ?? []),
    [user?.id, projectRoles, team],
  );

  // Project members who are not on this team yet.
  const candidates = useMemo(() => {
    const onTeam = new Set(team?.members.map((member) => member.user.id));
    return members
      .filter((member) => !onTeam.has(member.user.id))
      .map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      }));
  }, [members, team]);

  if (isLoading) return <PageSkeleton />;

  if (error || !team) {
    return (
      <ErrorState
        title={t('team.loadFailed')}
        description={error ? t(error.messageKey as never) : undefined}
        requestId={error?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  const canManageMembers = can(roles, 'team:manage_members');

  async function handleUpdate(input: TeamInput) {
    await updateTeam(input);
    toast({ tone: 'success', title: t('team.updated') });
    setIsEditOpen(false);
  }

  async function handleDelete() {
    if (!team) return;

    try {
      await deleteTeam();
      toast({ tone: 'success', title: t('team.deleted', { name: team.name }) });
      await navigate(projectTeamsPath(project.id), { replace: true });
    } catch (deleteError) {
      showError(deleteError);
      setIsConfirmingDelete(false);
    }
  }

  async function handleAdd(userId: string, input: TeamMemberInput) {
    const added = candidates.find((candidate) => candidate.id === userId);
    await addMember(userId, input);
    toast({
      tone: 'success',
      title: t('team.memberAdded', { name: added?.name ?? '' }),
    });
  }

  async function handleMemberUpdate(_userId: string, input: TeamMemberInput) {
    if (!editingMember) return;

    await updateMember(editingMember.user.id, input);
    toast({
      tone: 'success',
      title: t('team.memberUpdated', { name: editingMember.user.name }),
    });
    setEditingMember(null);
  }

  /* Never rejects: ConfirmDialog stays open until this settles, and a failure
     is reported through the toast. */
  async function handleRemove() {
    if (!pendingRemoval) return;

    try {
      await removeMember(pendingRemoval.user.id);
      toast({
        tone: 'success',
        title: t('team.memberRemoved', { name: pendingRemoval.user.name }),
      });
    } catch (removeError) {
      showError(removeError);
    } finally {
      setPendingRemoval(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-text-strong text-xl font-bold">{team.name}</h2>
          {team.description ? (
            <p className="text-text-subtle text-sm">{team.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {can(roles, 'team:update') ? (
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              {t('team.edit')}
            </Button>
          ) : null}
          {can(roles, 'team:delete') ? (
            <Button
              variant="danger"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('team.delete')}
            </Button>
          ) : null}
        </div>
      </div>

      {canManageMembers ? (
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t('team.memberAddTitle')}</CardTitle>
          </CardHeader>
          {candidates.length === 0 ? (
            <p className="text-text-subtle text-sm">{t('team.noCandidates')}</p>
          ) : (
            <TeamMemberForm
              candidates={candidates}
              submitLabel={t('team.memberAdd')}
              isPending={isAdding}
              onSubmit={handleAdd}
            />
          )}
        </Card>
      ) : null}

      {team.members.length === 0 ? (
        <Card>
          <EmptyState variant="circle" icon={<UsersRound />}>
            {t('team.membersEmpty')}
          </EmptyState>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('team.memberColumns.member')}</TableHead>
              <TableHead>{t('team.memberColumns.role')}</TableHead>
              <TableHead>{t('team.memberColumns.availability')}</TableHead>
              <TableHead>{t('team.memberColumns.workload')}</TableHead>
              <TableHead>{t('team.memberColumns.responsibilities')}</TableHead>
              {canManageMembers ? (
                <TableHead>
                  <span className="sr-only">
                    {t('team.memberColumns.actions')}
                  </span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <Avatar
                      name={member.user.name}
                      {...(member.user.avatarUrl
                        ? { src: member.user.avatarUrl }
                        : {})}
                    />
                    <AppLink
                      to={userPath(member.user.id)}
                      variant="subtle"
                      className="truncate font-medium"
                    >
                      {member.user.name}
                    </AppLink>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge tone={member.role === 'LEAD' ? 'primary' : 'neutral'}>
                    {t(`enums.teamRole.${member.role}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge tone={AVAILABILITY_TONES[member.availability]}>
                    {t(`enums.availability.${member.availability}`)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {member.workload}
                </TableCell>
                <TableCell className="text-text-subtle max-w-xs text-sm">
                  {member.responsibilities ?? t('team.noResponsibilities')}
                </TableCell>
                {canManageMembers ? (
                  <TableCell>
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingMember(member)}
                      >
                        {t('common.edit')}
                        <span className="sr-only"> {member.user.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingRemoval(member)}
                      >
                        {t('team.memberRemove')}
                        <span className="sr-only"> {member.user.name}</span>
                      </Button>
                    </span>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('team.editTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <TeamForm
              initialValues={team}
              submitLabel={t('common.save')}
              isPending={isUpdating}
              onSubmit={handleUpdate}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingMember !== null}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {t('team.memberEditTitle', {
                name: editingMember?.user.name ?? '',
              })}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {editingMember ? (
              <TeamMemberForm
                key={editingMember.id}
                initialValues={editingMember}
                submitLabel={t('common.save')}
                isPending={isUpdatingMember}
                onSubmit={handleMemberUpdate}
              />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('team.deleteConfirmTitle', { name: team.name })}
        description={t('team.deleteConfirmBody')}
        confirmLabel={t('team.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={t('team.memberRemoveConfirmTitle', {
          name: pendingRemoval?.user.name ?? '',
        })}
        description={t('team.memberRemoveConfirmBody', {
          name: pendingRemoval?.user.name ?? '',
          team: team.name,
        })}
        confirmLabel={t('team.memberRemove')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleRemove}
      />
    </section>
  );
}
