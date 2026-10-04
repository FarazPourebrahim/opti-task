import { Badge, Button } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectState } from '@contracts';
import { nextProjectStates } from '@/modules/project/utils/project.utils';

export const PROJECT_STATUS_TONES: Record<
  ProjectState,
  'neutral' | 'success' | 'blue'
> = {
  PLANNING: 'blue',
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  ARCHIVED: 'neutral',
};

type ProjectStatusControlProps = {
  status: ProjectState;
  /** Whether the viewer may move the project at all — a hint, not a guard. */
  canChange: boolean;
  /** Rejects with the failure; the caller reports it. */
  onChange: (status: ProjectState) => Promise<void>;
};

/**
 * Shows the project's status and offers only the moves the lifecycle allows
 * from it. An archived project offers none: archiving is final.
 */
export function ProjectStatusControl({
  status,
  canChange,
  onChange,
}: ProjectStatusControlProps) {
  const { t } = useTranslation();
  // Which move is in flight, so only that button spins.
  const [pending, setPending] = useState<ProjectState | null>(null);
  const transitions = nextProjectStates(status);

  async function handleChange(next: ProjectState) {
    setPending(next);
    try {
      await onChange(next);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm">
        <span className="text-text-subtle">{t('project.status')}</span>
        <Badge tone={PROJECT_STATUS_TONES[status]}>
          {t(`enums.projectState.${status}`)}
        </Badge>
      </p>

      {transitions.length === 0 ? (
        <p className="text-text-subtle text-sm">{t('project.statusFinal')}</p>
      ) : canChange ? (
        <div
          role="group"
          aria-label={t('project.statusChange')}
          className="flex flex-wrap gap-2"
        >
          {transitions.map((next) => (
            <Button
              key={next}
              variant={next === 'ARCHIVED' ? 'ghost' : 'outline'}
              size="sm"
              loading={pending === next}
              disabled={pending !== null}
              onClick={() => void handleChange(next)}
            >
              {t(`project.transition.${next}`)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
