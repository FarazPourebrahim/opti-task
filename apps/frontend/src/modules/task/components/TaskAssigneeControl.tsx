import { Avatar, Button } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import type { TaskAssignee } from '@/modules/task/hooks/useTaskActions';
import { AppLink, MemberPicker } from '@/shared/components';
import { userPath } from '@/shared/routes/route.constants';

type TaskAssigneeControlProps = {
  assignee: TaskAssignee | null;
  /** Project members: who the task can be given to. */
  candidates: readonly MemberCandidate[];
  /** A hint, not a guard. */
  canAssign: boolean;
  /** `null` unassigns. */
  onAssign: (assignee: TaskAssignee | null) => void;
};

/** Who the task is assigned to, and a way to change or clear that. */
export function TaskAssigneeControl({
  assignee,
  candidates,
  canAssign,
  onAssign,
}: TaskAssigneeControlProps) {
  const { t } = useTranslation();
  const [pickedId, setPickedId] = useState('');

  const others = candidates.filter(
    (candidate) => candidate.id !== assignee?.id,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const picked = others.find((candidate) => candidate.id === pickedId);
    if (!picked) return;

    onAssign({ id: picked.id, name: picked.name });
    setPickedId('');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm">
          <span className="text-text-subtle">{t('task.assignee')}</span>
          {assignee ? (
            <>
              <Avatar
                size="xs"
                name={assignee.name}
                {...(assignee.avatarUrl ? { src: assignee.avatarUrl } : {})}
              />
              <AppLink
                to={userPath(assignee.id)}
                variant="subtle"
                className="font-medium"
              >
                {assignee.name}
              </AppLink>
            </>
          ) : (
            <span className="font-medium">{t('task.unassigned')}</span>
          )}
        </span>
        {canAssign && assignee ? (
          <Button variant="ghost" size="sm" onClick={() => onAssign(null)}>
            {t('task.unassign')}
          </Button>
        ) : null}
      </div>

      {canAssign && others.length > 0 ? (
        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <div className="min-w-0 flex-1">
            <MemberPicker
              label={t('task.assign')}
              hint={t('task.assigneeHint')}
              candidates={others}
              value={pickedId}
              onValueChange={setPickedId}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pickedId === ''}>
            {t('task.assign')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
