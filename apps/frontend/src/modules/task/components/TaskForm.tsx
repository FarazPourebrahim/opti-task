import { Button, DatePicker, Input, Textarea } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { TASK_PRIORITIES } from '@contracts';
import type { TaskPriority } from '@contracts';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { STORY_POINTS_MAX } from '@/modules/task/constants/task.constants';
import type { PlanningOption } from '@/modules/task/hooks/useTasks';
import {
  createTaskSchema,
  taskDetailsSchema,
} from '@/modules/task/schemas/task.schema';
import type {
  CreateTaskInput,
  TaskDetailsInput,
} from '@/modules/task/schemas/task.schema';
import {
  FormError,
  FormField,
  MemberPicker,
  SelectField,
} from '@/shared/components';
import type { SelectOption } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { apiToDateInput, dateInputToApi } from '@/shared/utils/date.utils';
import { toFieldErrors } from '@/shared/utils/form.utils';

/** A select cannot hold an empty value, so "nothing chosen" has a name. */
const NONE = 'NONE';

type DetailsValues = {
  title: string;
  description?: string | null | undefined;
  priority: TaskPriority;
  dueDate?: string | null | undefined;
};

type SharedProps = {
  submitLabel: string;
  isPending: boolean;
};

/**
 * Creating asks for everything a task can start with; editing covers only what
 * `updateTask` changes — the rest each have their own control and their own
 * audit entry.
 */
type TaskFormProps = SharedProps &
  (
    | {
        mode: 'create';
        /** Project members: who the task can be given to. */
        assignees: readonly MemberCandidate[];
        sprints: readonly PlanningOption[];
        epics: readonly PlanningOption[];
        /** Rejects with the failure; the form turns it into a form-level error. */
        onSubmit: (input: CreateTaskInput) => Promise<void>;
      }
    | {
        mode: 'edit';
        initialValues: DetailsValues;
        onSubmit: (input: TaskDetailsInput) => Promise<void>;
        onCancel: () => void;
      }
  );

export function TaskForm(props: TaskFormProps) {
  const { t } = useTranslation();
  const { submitLabel, isPending } = props;
  const initial = props.mode === 'edit' ? props.initialValues : undefined;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(
    initial?.priority ?? 'MEDIUM',
  );
  // As the date field holds it: `YYYY-MM-DD`, or null when empty.
  const [dueDay, setDueDay] = useState<string | null>(
    apiToDateInput(initial?.dueDate),
  );
  const [storyPoints, setStoryPoints] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [sprintId, setSprintId] = useState(NONE);
  const [epicId, setEpicId] = useState(NONE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const details = {
      title,
      description,
      priority,
      // The API rejects a bare date; this is the full instant it accepts.
      dueDate: dateInputToApi(dueDay),
    };

    try {
      if (props.mode === 'edit') {
        const parsed = taskDetailsSchema.safeParse(details);
        if (!parsed.success) {
          setFieldErrors(toFieldErrors(parsed.error));
          return;
        }
        setFieldErrors({});
        await props.onSubmit(parsed.data);
        return;
      }

      const parsed = createTaskSchema.safeParse({
        ...details,
        // Empty means "no estimate"; anything else must be a whole number.
        storyPoints: storyPoints.trim() === '' ? null : Number(storyPoints),
        assigneeId: assigneeId === '' ? null : assigneeId,
        sprintId: sprintId === NONE ? null : sprintId,
        epicId: epicId === NONE ? null : epicId,
      });
      if (!parsed.success) {
        setFieldErrors(toFieldErrors(parsed.error));
        return;
      }
      setFieldErrors({});
      await props.onSubmit(parsed.data);
    } catch (error) {
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  function errorFor(field: string): string | undefined {
    const key = fieldErrors[field];
    return key ? t(key as never) : undefined;
  }

  function planningOptions(
    options: readonly PlanningOption[],
    noneLabel: string,
  ): Array<SelectOption<string>> {
    return [
      { value: NONE, label: noneLabel },
      ...options.map((option) => ({ value: option.id, label: option.name })),
    ];
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      <FormField label={t('task.title')} error={errorFor('title')}>
        <Input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <FormField
        label={t('task.description')}
        hint={t('common.optional')}
        error={errorFor('description')}
      >
        <Textarea
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('task.priority')}
          value={priority}
          onValueChange={setPriority}
          disabled={isPending}
          options={TASK_PRIORITIES.map((option) => ({
            value: option,
            label: t(`enums.taskPriority.${option}`),
          }))}
        />
        <FormField
          label={t('task.dueDate')}
          hint={t('task.dueDateHint')}
          error={errorFor('dueDate')}
        >
          <DatePicker
            value={dueDay}
            onValueChange={setDueDay}
            disabled={isPending}
          />
        </FormField>
      </div>

      {props.mode === 'create' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('task.storyPoints')}
              hint={t('task.storyPointsHint')}
              error={errorFor('storyPoints')}
            >
              <Input
                type="number"
                name="storyPoints"
                inputMode="numeric"
                min={0}
                max={STORY_POINTS_MAX}
                step={1}
                value={storyPoints}
                onChange={(event) => setStoryPoints(event.target.value)}
                disabled={isPending}
              />
            </FormField>
            <MemberPicker
              label={t('task.assignee')}
              hint={t('common.optional')}
              candidates={props.assignees}
              value={assigneeId}
              onValueChange={setAssigneeId}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('task.sprint')}
              value={sprintId}
              onValueChange={setSprintId}
              disabled={isPending}
              options={planningOptions(props.sprints, t('task.noSprint'))}
            />
            <SelectField
              label={t('task.epic')}
              value={epicId}
              onValueChange={setEpicId}
              disabled={isPending}
              options={planningOptions(props.epics, t('task.noEpic'))}
            />
          </div>
        </>
      ) : null}

      <div className="flex justify-end gap-2">
        {props.mode === 'edit' ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={props.onCancel}
          >
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
