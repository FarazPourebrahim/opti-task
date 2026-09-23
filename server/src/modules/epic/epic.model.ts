export type CreateEpicInput = {
  name: string;
  description?: string | null;
};

export type UpdateEpicInput = {
  name?: string;
  description?: string | null;
};

export type CreateMilestoneInput = {
  name: string;
  description?: string | null;
  dueDate?: Date | null;
  epicId?: string | null;
};

/** Epic progress derived from child-task completion (count-based, 0–100). */
export type EpicProgress = {
  totalTasks: number;
  completedTasks: number;
  progress: number;
};
