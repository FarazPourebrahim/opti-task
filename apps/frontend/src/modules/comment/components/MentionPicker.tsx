import { Chip } from '@averoui/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { MemberPicker } from '@/shared/components';

type MentionPickerProps = {
  /** Project members: the only people who can be mentioned from here. */
  candidates: readonly MemberCandidate[];
  selectedIds: readonly string[];
  onChange: (selectedIds: string[]) => void;
  /** Already translated. */
  error?: string | undefined;
  disabled?: boolean | undefined;
};

/**
 * Chooses who a comment mentions.
 *
 * The API takes the ids of the people mentioned and never reads the text, so
 * this is the only way to mention someone: an `@name` typed into the comment
 * notifies nobody, and the hint says so.
 */
export function MentionPicker({
  candidates,
  selectedIds,
  onChange,
  error,
  disabled = false,
}: MentionPickerProps) {
  const { t } = useTranslation();

  const selected = candidates.filter((candidate) =>
    selectedIds.includes(candidate.id),
  );
  const remaining = candidates.filter(
    (candidate) => !selectedIds.includes(candidate.id),
  );

  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {remaining.length > 0 ? (
        <MemberPicker
          label={t('comment.mention.label')}
          hint={t('comment.mention.hint')}
          candidates={remaining}
          // Always empty: picking someone moves them to the list below, and
          // the field is ready for the next name.
          value=""
          onValueChange={(userId) => {
            if (userId) onChange([...selectedIds, userId]);
          }}
          error={error}
          disabled={disabled}
        />
      ) : null}

      {selected.length > 0 ? (
        <ul
          className="flex flex-wrap gap-2"
          aria-label={t('comment.mention.listLabel')}
        >
          {selected.map((person) => (
            <li key={person.id}>
              <Chip variant="skill" className="gap-1">
                {person.name}
                <button
                  type="button"
                  className="rounded-full focus-visible:outline-2"
                  aria-label={t('comment.mention.remove', {
                    name: person.name,
                  })}
                  disabled={disabled}
                  onClick={() =>
                    onChange(selectedIds.filter((id) => id !== person.id))
                  }
                >
                  <X aria-hidden className="size-3" />
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
