import type { TaskPriority, TaskStatus } from '@prisma/client';

export type StatusCount = { status: TaskStatus; count: number };
export type PriorityCount = { priority: TaskPriority; count: number };

export type SprintTrendPoint = {
  sprintId: string;
  name: string;
  committedStoryPoints: number;
  completedStoryPoints: number;
};

export type IndividualWorkload = {
  assigneeId: string;
  activeTasks: number;
  activeStoryPoints: number;
  completedTasks: number;
};

export type ProjectAnalytics = {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionRate: number;
  teamVelocity: number;
  taskDistributionByStatus: StatusCount[];
  taskDistributionByPriority: PriorityCount[];
  storyPointTrends: SprintTrendPoint[];
  individualWorkloads: IndividualWorkload[];
};

export type UserAnalytics = {
  userId: string;
  completedTasks: number;
  historicalStoryPoints: number;
  avgCompletionSeconds: number | null;
  velocity: number | null;
  activeAssignments: number;
};
