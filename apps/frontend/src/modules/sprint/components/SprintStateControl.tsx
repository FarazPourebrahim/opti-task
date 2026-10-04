import { Badge, Button } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SprintState } from '@contracts';
import { SPRINT_STATE_TONES } from '@/modules/sprint/constants/sprint.constants';
import { nextSprintStates } from '@/modules/sprint/utils/sprint.utils';

type SprintStateControlProps = {
  state: SprintState;
  /** Whether the viewer may move the sprint at all — a hint, not a guard. */
  canChange: boolean;
  /** Rejects with the failure; the caller reports it. */
  onChange: (state: SprintState) => Promise<void>;
};

/**
 * Shows the sprint's state and offers only the moves the lifecycle allows
 * from it. A completed or cancelled sprint offers none: both are final.
 */
export function SprintStateControl({
  state,
  canChange,
  onChange,
}: SprintStateControlProps) {
  const { t } = useTranslation();
  // Which move is in flight, so only that button spins.
  const [pending, setPending] = useState<SprintState | null>(null);
  const transitions = nextSprintStates(state);

  async function handleChange(next: SprintState) {
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
        <span className="text-text-subtle">{t('sprint.state')}</span>
        <Badge tone={SPRINT_STATE_TONES[state]}>
          {t(`enums.sprintState.${state}`)}
        </Badge>
      </p>

      {transitions.length === 0 ? (
        <p className="text-text-subtle text-sm">{t('sprint.stateFinal')}</p>
      ) : canChange ? (
        <div
          role="group"
          aria-label={t('sprint.stateChange')}
          className="flex flex-wrap gap-2"
        >
          {transitions.map((next) => (
            <Button
              key={next}
              variant={next === 'CANCELLED' ? 'ghost' : 'outline'}
              size="sm"
              loading={pending === next}
              disabled={pending !== null}
              onClick={() => void handleChange(next)}
            >
              {t(`sprint.transition.${next}`)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
