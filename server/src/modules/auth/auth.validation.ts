import { z } from 'zod';
import { ValidationError } from '@shared/errors';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from './auth.model.js';

/**
 * Input validation + password policy. All auth inputs pass through here before
 * the service trusts them (docs/security.md: never trust client data).
 */
const passwordPolicy = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be at most 100 characters')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const emailSchema = z.string().trim().toLowerCase().email('Invalid email');

const registerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, 'Name is required').max(100),
  password: passwordPolicy,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordPolicy,
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid input';
    throw new ValidationError(message);
  }
  return result.data;
}

export function validateRegister(input: unknown): RegisterInput {
  return parse(registerSchema, input);
}

export function validateLogin(input: unknown): LoginInput {
  return parse(loginSchema, input);
}

export function validateChangePassword(input: unknown): ChangePasswordInput {
  return parse(changePasswordSchema, input);
}

export function normalizeEmail(email: string): string {
  return parse(emailSchema, email);
}
