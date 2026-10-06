import { Button, EmptyState, Input } from '@averoui/react';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { useSkills } from '@/modules/user/hooks/useProfile';
import { skillSchema } from '@/modules/user/schemas/user.schema';
import { FormField } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';

type SkillsEditorProps = {
  skills: readonly string[];
};

export function SkillsEditor({ skills }: SkillsEditorProps) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const { addSkill, removeSkill, isAdding, isRemoving } = useSkills();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = skillSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    if (skills.includes(parsed.data)) {
      setError('user.validation.skillDuplicate');
      return;
    }
    setError(null);

    try {
      await addSkill(parsed.data);
      setDraft('');
    } catch (addError) {
      showError(addError);
    }
  }

  async function handleRemove(skill: string) {
    try {
      await removeSkill(skill);
    } catch (removeError) {
      showError(removeError);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {skills.length === 0 ? (
        <EmptyState variant="circle" icon={<Sparkles />}>
          {t('user.skillsEmpty')}
        </EmptyState>
      ) : (
        <ul aria-label={t('user.skillsTitle')} className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              key={skill}
              className="bg-surface-sunken text-text-strong inline-flex items-center gap-1 rounded-full py-1 ps-3 pe-1 text-sm"
            >
              {skill}
              <button
                type="button"
                aria-label={t('user.skillRemove', { skill })}
                disabled={isRemoving}
                onClick={() => void handleRemove(skill)}
                className="focus-visible:ring-primary/40 cursor-pointer rounded-full p-1 hover:bg-black/10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={handleAdd}
        noValidate
      >
        <div className="min-w-48 flex-1">
          <FormField
            label={t('user.skillAddLabel')}
            error={error ? t(error as never) : undefined}
          >
            <Input
              name="skill"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={isAdding}
            />
          </FormField>
        </div>
        <Button type="submit" variant="outline" loading={isAdding}>
          {t('user.skillAdd')}
        </Button>
      </form>
    </div>
  );
}
