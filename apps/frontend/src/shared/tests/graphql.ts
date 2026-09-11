import { HttpResponse, graphql as mswGraphql } from 'msw';
import type { ErrorCode } from '@contracts';

/**
 * MSW helpers for GraphQL.
 *
 * Tests mock at the network boundary, so the link chain, error normalization
 * and cache all run for real. Nothing here stubs a hook or a service.
 */

/** Responds with data for a named operation. */
export function mockQuery(
  name: string,
  data: Record<string, unknown>,
  init?: { headers?: Record<string, string> },
) {
  return mswGraphql.query(name, () =>
    HttpResponse.json({ data }, init?.headers ? { headers: init.headers } : {}),
  );
}

export function mockMutation(name: string, data: Record<string, unknown>) {
  return mswGraphql.mutation(name, () => HttpResponse.json({ data }));
}

/**
 * Responds with a GraphQL error carrying one of the API's stable codes —
 * the shape the real server produces (`extensions.code`, nothing else).
 */
export function mockQueryError(
  name: string,
  code: ErrorCode,
  message = 'Request failed',
) {
  return mswGraphql.query(name, () =>
    HttpResponse.json({
      errors: [{ message, extensions: { code } }],
      data: null,
    }),
  );
}

export function mockMutationError(
  name: string,
  code: ErrorCode,
  message = 'Request failed',
) {
  return mswGraphql.mutation(name, () =>
    HttpResponse.json({
      errors: [{ message, extensions: { code } }],
      data: null,
    }),
  );
}

/** A transport-level failure: the request never produced a response. */
export function mockNetworkFailure(name: string) {
  return mswGraphql.query(name, () => HttpResponse.error());
}

/**
 * A non-GraphQL body, e.g. a proxy's HTML error page. Returned as a raw
 * Response because MSW's GraphQL resolver types only describe GraphQL bodies —
 * which is exactly the case being simulated.
 */
export function mockNonGraphqlResponse(name: string, status = 502) {
  return mswGraphql.query(
    name,
    () =>
      new Response('<html><body>Bad Gateway</body></html>', {
        status,
        headers: { 'content-type': 'text/html' },
      }) as never,
  );
}

/**
 * Answers a named operation differently on each call.
 *
 * Used to prove a retry actually replays the operation: first call fails,
 * second succeeds.
 */
export function mockQuerySequence(
  name: string,
  responses: ReadonlyArray<() => Response>,
) {
  let call = 0;
  return mswGraphql.query(name, () => {
    const respond = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return respond?.() ?? HttpResponse.json({ data: null });
  });
}

export { HttpResponse, mswGraphql as graphql };
