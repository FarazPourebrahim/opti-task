import { z } from 'zod';

/**
 * Client-side validation, mirroring `apps/backend/src/modules/auth/auth.validation.ts`.
 *
 * This duplication is deliberate, not laziness. The API's `extensions` carries
 * a `code` and nothing else — there are no per-field messages — so a server
 * rejection can only ever be shown as a form-level error. Matching the server's
 * rules here is what lets a user see *which* field is wrong, and the server
 * remains the authority either way.
 *
 * If the backend's policy changes, these must change with it; `auth.test.tsx`
 * asserts the exact boundaries so a drift shows up as a failing test.
 */

/** 8–100 characters, at least one letter and at least one digit. */
export const passwordSchema = z
  .string()
  .min(8, 'auth.validation.passwordTooShort')
  .max(100, 'auth.validation.passwordTooLong')
  .regex(/[a-zA-Z]/, 'auth.validation.passwordNeedsLetter')
  .regex(/[0-9]/, 'auth.validation.passwordNeedsNumber');

/**
 * Trimmed and lower-cased to match the server, so "  Me@Acme.test " and
 * "me@acme.test" are the same account rather than a confusing duplicate-email
 * error at submit time.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('auth.validation.emailInvalid');

export const loginSchema = z.object({
  email: emailSchema,
  // Only presence is checked: the policy applies when *setting* a password,
  // and applying it here would tell an attacker which passwords are possible.
  password: z.string().min(1, 'auth.validation.passwordRequired'),
});

export const registerSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .min(1, 'auth.validation.nameRequired')
    .max(100, 'auth.validation.nameTooLong'),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'auth.validation.passwordRequired'),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'auth.validation.passwordUnchanged',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export { toFieldErrors } from '@/shared/utils/form.utils';
