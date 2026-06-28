import 'dotenv/config';
import { z } from 'zod';

/**
 * Typed environment loader. Fails fast at startup if required vars are missing
 * or malformed (docs/security.md: secrets only via env, never in code).
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(1).optional(),
  JWT_REFRESH_SECRET: z.string().min(1).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // External AI provider resilience (timeout per call + retry attempts).
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  AI_REQUEST_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const data = parsed.data;

  // Secrets are optional for local/test convenience but mandatory in production.
  if (data.NODE_ENV === 'production') {
    const missing = (
      [
        ['DATABASE_URL', data.DATABASE_URL],
        ['JWT_ACCESS_SECRET', data.JWT_ACCESS_SECRET],
        ['JWT_REFRESH_SECRET', data.JWT_REFRESH_SECRET],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`,
      );
    }
  }

  return data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';