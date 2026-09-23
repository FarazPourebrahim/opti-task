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
  /**
   * Browser origins allowed to send credentialed requests, comma-separated.
   *
   * Required in production: a credentialed CORS response may not use the `*`
   * wildcard, so without an explicit list every browser request from the web
   * client is rejected by the browser itself.
   */
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .pipe(
      z
        .array(
          z
            .string()
            .refine(
              (origin) => {
                try {
                  // An origin is scheme + host + port and nothing else; a
                  // trailing slash or path never matches the browser's header.
                  return new URL(origin).origin === origin;
                } catch {
                  return false;
                }
              },
              'must be a bare origin such as https://app.example.com (no path or trailing slash)',
            ),
        ),
    ),
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
    const missing: string[] = (
      [
        ['DATABASE_URL', data.DATABASE_URL],
        ['JWT_ACCESS_SECRET', data.JWT_ACCESS_SECRET],
        ['JWT_REFRESH_SECRET', data.JWT_REFRESH_SECRET],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    // A credentialed CORS response cannot use `*`, so an empty list in
    // production means no browser can talk to this API at all.
    if (data.CORS_ORIGINS.length === 0) {
      missing.push('CORS_ORIGINS');
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`,
      );
    }
  }

  // Outside production the local dev server is assumed, so a fresh clone runs
  // without anyone having to discover this variable first.
  const corsOrigins =
    data.CORS_ORIGINS.length > 0
      ? data.CORS_ORIGINS
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  return { ...data, CORS_ORIGINS: corsOrigins };
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';