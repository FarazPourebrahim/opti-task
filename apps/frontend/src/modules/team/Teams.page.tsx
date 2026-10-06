import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  useToast,
} from '@averoui/react';
import { Plus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { TeamForm } from '@/modules/team/components/TeamForm';
import { useCreateTeam } from '@/modules/team/hooks/useTeam';
import type { TeamInput } from '@/modules/team/schemas/team.schema';
import { can } from '@/shared/lib/capabilities';
import { teamPath } from '@/shared/routes/route.constants';

export function TeamsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { project, roles } = useProjectContext();
  const { createTeam, isCreating } = useCreateTeam(project.id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canCreate = can(roles, 'team:create');

  async function handleCreate(input: TeamInput) {
    const created = await createTeam(input);
    if (!created) return;

    toast({
      tone: 'success',
      title: t('team.created', { name: created.name }),
    });
    setIsCreateOpen(false);
    await navigate(teamPath(project.id, created.id));
  }

  const createButton = canCreate ? (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus aria-hidden className="size-4" />
      {t('team.new')}
    </Button>
  ) : undefined;

  return (
    <section className="flex flex-col gap-4">
      {project.teams.length === 0 ? (
        <Card>
          <EmptyState
            variant="circle"
            icon={<UsersRound />}
            action={createButton}
          >
            {t('team.empty')}
          </EmptyState>
        </Card>
      ) : (
        <>
          {createButton ? (
            <div className="flex justify-end">{createButton}</div>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {project.teams.map((team) => (
              <li key={team.id}>
                <Card asChild interactive padding="md" className="h-full">
                  <RouterLink
                    to={teamPath(project.id, team.id)}
                    className="flex flex-col gap-2"
                  >
                    <span className="text-text-strong font-semibold">
                      {team.name}
                    </span>
                    {team.description ? (
                      <span className="text-text-subtle line-clamp-2 text-sm">
                        {team.description}
                      </span>
                    ) : null}
                    <span className="text-text-subtle mt-auto text-xs">
                      {t('team.members', { count: team.memberCount })}
                    </span>
                  </RouterLink>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('team.createTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <TeamForm
              submitLabel={t('team.create')}
              isPending={isCreating}
              onSubmit={handleCreate}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </section>
  );
}
