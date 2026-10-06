import { Button } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { SORT_DIRECTIONS, TASK_PRIORITIES, TASK_STATUSES } from '@contracts';
import type { SortDirection, TaskPriority, TaskStatus } from '@contracts';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import type { PlanningOption } from '@/modules/task/hooks/useTasks';
import { SelectField } from '@/shared/components';
import type { SelectOption } from '@/shared/components';
import type { TaskSortField } from '@/shared/graphql/generated/graphql';

/** A select cannot hold an empty value, so "no filter" has a name. */
export const ANY = 'ANY';
type Any = typeof ANY;

export type TaskFilterValues = {
  status: TaskStatus | Any;
  priority: TaskPriority | Any;
  assigneeId: string;
  sprintId: string;
  epicId: string;
  labelId: string;
  sortField: TaskSortField;
  sortDirection: SortDirection;
};

export const DEFAULT_TASK_FILTERS: TaskFilterValues = {
  status: ANY,
  priority: ANY,
  assigneeId: ANY,
  sprintId: ANY,
  epicId: ANY,
  labelId: ANY,
  sortField: 'CREATED_AT',
  sortDirection: 'DESC',
};

const SORT_FIELDS: readonly TaskSortField[] = [
  'CREATED_AT',
  'PRIORITY',
  'DUE_DATE',
];

type TaskFiltersProps = {
  values: TaskFilterValues;
  onChange: (values: TaskFilterValues) => void;
  assignees: readonly MemberCandidate[];
  sprints: readonly PlanningOption[];
  epics: readonly PlanningOption[];
  labels: readonly PlanningOption[];
  /** Whether anything narrows the list — sorting alone does not. */
  isFiltered: boolean;
};

export function TaskFilters({
  values,
  onChange,
  assignees,
  sprints,
  epics,
  labels,
  isFiltered,
}: TaskFiltersProps) {
  const { t } = useTranslation();
  const any: SelectOption<Any> = { value: ANY, label: t('task.list.all') };

  function named(
    options: readonly PlanningOption[],
  ): Array<SelectOption<string>> {
    return [
      any,
      ...options.map((option) => ({ value: option.id, label: option.name })),
    ];
  }

  function set<Key extends keyof TaskFilterValues>(key: Key) {
    return (value: TaskFilterValues[Key]) =>
      onChange({ ...values, [key]: value });
  }

  return (
    <div
      role="group"
      aria-label={t('task.list.filters')}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <SelectField<TaskStatus | Any>
        label={t('task.status')}
        value={values.status}
        onValueChange={set('status')}
        options={[
          any,
          ...TASK_STATUSES.map((status) => ({
            value: status,
            label: t(`enums.taskStatus.${status}`),
          })),
        ]}
      />
      <SelectField<TaskPriority | Any>
        label={t('task.priority')}
        value={values.priority}
        onValueChange={set('priority')}
        options={[
          any,
          ...TASK_PRIORITIES.map((priority) => ({
            value: priority,
            label: t(`enums.taskPriority.${priority}`),
          })),
        ]}
      />
      <SelectField
        label={t('task.assignee')}
        value={values.assigneeId}
        onValueChange={set('assigneeId')}
        options={named(assignees)}
      />
      <SelectField
        label={t('task.sprint')}
        value={values.sprintId}
        onValueChange={set('sprintId')}
        options={named(sprints)}
      />
      <SelectField
        label={t('task.epic')}
        value={values.epicId}
        onValueChange={set('epicId')}
        options={named(epics)}
      />
      <SelectField
        label={t('task.list.label')}
        hint={t('task.list.labelHint')}
        value={values.labelId}
        onValueChange={set('labelId')}
        options={named(labels)}
      />
      <SelectField
        label={t('task.list.sortBy')}
        value={values.sortField}
        onValueChange={set('sortField')}
        options={SORT_FIELDS.map((field) => ({
          value: field,
          label: t(`enums.taskSortField.${field}`),
        }))}
      />
      <SelectField
        label={t('task.list.direction')}
        value={values.sortDirection}
        onValueChange={set('sortDirection')}
        options={SORT_DIRECTIONS.map((direction) => ({
          value: direction,
          label: t(`enums.sortDirection.${direction}`),
        }))}
      />
      {isFiltered ? (
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...DEFAULT_TASK_FILTERS,
                sortField: values.sortField,
                sortDirection: values.sortDirection,
              })
            }
          >
            {t('task.list.clear')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
