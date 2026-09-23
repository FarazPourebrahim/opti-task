import { z } from 'zod';

/**
 * Typed, fail-fast frontend configuration.
 *
 * A missing or malformed value must never produce a silently broken app that
 * fails later at the first request — it throws at module load with a message
 * naming the offending variable.
 */
const envSchema = z.object({
  VITE_API_URL: z
    .string()
    .url('must be an absolute URL, e.g. http://localhost:4000/graphql'),
  VITE_WS_URL: z
    .string()
    .url('must be an absolute URL, e.g. ws://localhost:4000/graphql')
    .refine(
      (value) => value.startsWith('ws://') || value.startsWith('wss://'),
      'must use the ws:// or wss:// protocol',
    ),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Exported separately from `env` so the failure path is testable without
 * mutating `import.meta.env`.
 */
export function parseEnv(raw: unknown): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid frontend environment configuration:\n${details}\n\n` +
        'Copy .env.example to .env and fill it in.',
    );
  }

  return result.data;
}

export const env = parseEnv(import.meta.env);
