import type { OrgRole, Prisma } from '@prisma/client';

export type CreateOrganizationInput = {
  name: string;
  description?: string | null | undefined;
  logoUrl?: string | null | undefined;
};

export type UpdateOrganizationInput = {
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
  settings?: Prisma.InputJsonValue;
};

export type InviteMemberInput = {
  email: string;
  role?: OrgRole | undefined;
};
