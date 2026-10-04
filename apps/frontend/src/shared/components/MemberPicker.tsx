import { Combobox } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { FormField } from './FormField';

export type MemberPickerCandidate = {
  id: string;
  name: string;
  email: string;
};

type MemberPickerProps = {
  label: string;
  /**
   * Who can be picked. The caller supplies them from a scoped membership — an
   * organisation's, a project's, a team's — never from the global user
   * directory, which lists every account in the system.
   */
  candidates: readonly MemberPickerCandidate[];
  /** The picked person's id, or an empty string for nobody. */
  value: string;
  onValueChange: (userId: string) => void;
  hint?: string | undefined;
  /** Already translated. */
  error?: string | undefined;
  disabled?: boolean | undefined;
};

/**
 * Picks one person from a known set, by typing a name or an email.
 */
export function MemberPicker({
  label,
  candidates,
  value,
  onValueChange,
  hint,
  error,
  disabled = false,
}: MemberPickerProps) {
  const { t } = useTranslation();

  return (
    <FormField label={label} hint={hint} error={error} disabled={disabled}>
      <Combobox
        value={value}
        onValueChange={onValueChange}
        emptyMessage={t('common.noMatchingPeople')}
        options={candidates.map((candidate) => ({
          value: candidate.id,
          label: candidate.name,
          // Two people can share a name; the address tells them apart.
          keywords: [candidate.email],
        }))}
      />
    </FormField>
  );
}
