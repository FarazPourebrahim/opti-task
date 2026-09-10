import type { SeniorityLevel } from '@prisma/client';

export type UpdateProfileInput = {
  name?: string | undefined;
  avatarUrl?: string | null | undefined;
  seniority?: SeniorityLevel | null | undefined;
};

export type AddExpertiseInput = {
  tag: string;
  confidenceScore?: number | undefined;
};

export type UserFilter = {
  emailContains?: string | null;
  nameContains?: string | null;
};
