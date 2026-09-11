import { graphql } from '@/shared/graphql/generated';

/**
 * The platform self-test.
 *
 * `health` is the one query that needs no auth and no domain data, so it proves
 * the whole chain — codegen, link order, cookies, error normalization — before
 * any feature depends on it. Feature operations live in
 * `modules/<feature>/graphql/<domain>.operations.ts`.
 */
export const HealthQuery = graphql(`
  query Health {
    health {
      status
      uptimeSeconds
      timestamp
    }
  }
`);
