import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { SetContextLink } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { relayStylePagination } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { catchError, from, map, mergeMap, throwError } from 'rxjs';
import { env } from '@/shared/config';
import { ApiError, toApiError } from '@/shared/lib/apiError';
import {
  CLIENT_HEADER,
  CLIENT_HEADER_VALUE,
  refreshSession,
} from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  getAccessToken,
  onAccessTokenChange,
} from '@/shared/services/session.store';

/** Marks an operation that has already been retried, so a retry cannot loop. */
const RETRIED = 'optitaskRetried';

function readRequestId(operation: {
  getContext: () => Record<string, unknown>;
}): string | undefined {
  const response = operation.getContext()['response'];
  if (!(response instanceof Response)) return undefined;
  return response.headers.get('x-request-id') ?? undefined;
}

function isUnauthenticated(error: unknown): boolean {
  return ApiError.is(error) && error.kind === 'unauthorized';
}

/**
 * Sends a header no cross-site form can set.
 *
 * A custom header forces a CORS preflight, which a `<form>` POST from another
 * origin cannot satisfy — so this is the CSRF defence that backs up the
 * `SameSite=Lax` cookie. The backend must allow it (prerequisite P2).
 */
const clientHeaderLink = new SetContextLink((prevContext) => ({
  headers: {
    ...prevContext.headers,
    [CLIENT_HEADER]: CLIENT_HEADER_VALUE,
  },
}));

/**
 * Turns every failure into an `ApiError`, whatever shape it arrived in.
 *
 * Two different things are handled here because Apollo treats them
 * differently. A transport failure (no response, a 5xx, an unparseable body)
 * travels the observable's error channel. A GraphQL error in an otherwise
 * successful 200 does NOT — it rides along as `result.errors`, and Apollo
 * raises `CombinedGraphQLErrors` for it *above* the link chain, where no link
 * can see it. Converting those results into thrown errors here is what puts
 * both on one path, and it is what lets the refresh link below see an expired
 * session at all.
 */
const errorNormalizationLink = new ApolloLink((operation, forward) =>
  forward(operation).pipe(
    map((result) => {
      const errors = result.errors;
      if (errors && errors.length > 0) {
        throw toApiError(new CombinedGraphQLErrors(result, errors), {
          requestId: readRequestId(operation),
        });
      }
      return result;
    }),
    catchError((error: unknown) =>
      throwError(() => toApiError(error, { requestId: readRequestId(operation) })),
    ),
  ),
);

type SessionExpiredHandler = () => void;

/**
 * Handles authentication failure once, for the whole app.
 *
 * Hooks and components never deal with a 401: an expired access token is
 * refreshed and the original operation replayed, invisibly. Only a failed
 * refresh surfaces, as a session-expired signal.
 */
function createAuthRefreshLink(onSessionExpired: SessionExpiredHandler) {
  return new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      catchError((error: unknown) => {
        if (!isUnauthenticated(error)) return throwError(() => error);

        // Already replayed once — refreshing again would loop.
        if (operation.getContext()[RETRIED] === true) {
          return throwError(() => error);
        }

        return from(refreshSession()).pipe(
          mergeMap((refreshed) => {
            if (!refreshed) {
              onSessionExpired();
              return throwError(() => error);
            }

            operation.setContext({ [RETRIED]: true });
            return forward(operation);
          }),
        );
      }),
    ),
  );
}

function createHttpLink(): ApolloLink {
  return new HttpLink({
    uri: env.VITE_API_URL,
    // Sends the HTTP-only auth cookies. The backend must reflect an explicit
    // origin for this to be accepted (prerequisite P1).
    credentials: 'include',
  });
}

/**
 * The subscription transport.
 *
 * Authenticates through `connectionParams`, which is re-evaluated on every
 * connect — so a token refreshed mid-session is picked up by the next attempt.
 * A token change terminates the socket so that reconnect happens immediately
 * rather than at the next network blip.
 */
function createWsLink(): ApolloLink {
  const wsClient = createClient({
    url: env.VITE_WS_URL,
    lazy: true,
    retryAttempts: Infinity,
    connectionParams: () => {
      const token = getAccessToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  });

  onAccessTokenChange(() => {
    // Reconnects with the new credentials; a null token closes the socket.
    void wsClient.terminate();
  });

  return new GraphQLWsLink(wsClient);
}

/**
 * Cache policies.
 *
 * Every paginated field is relay-style so `fetchMore` appends rather than
 * replaces. `keyArgs` lists the arguments that make a DIFFERENT list: omit one
 * and two filters merge into a single cache entry, so switching filters shows
 * the wrong rows. `first`/`after` are deliberately absent — they page within a
 * list rather than identifying one.
 */
function createCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: relayStylePagination(['filter', 'orderBy']),
          myOrganizations: relayStylePagination(),
          myNotifications: relayStylePagination(['unreadOnly']),
        },
      },
      Organization: {
        fields: {
          projects: relayStylePagination(['status']),
          members: relayStylePagination(),
        },
      },
      Project: {
        fields: {
          members: relayStylePagination(),
          tasks: relayStylePagination([
            'filter',
            'sortField',
            'sortDirection',
          ]),
          sprints: relayStylePagination(),
          epics: relayStylePagination(),
          aiRecommendations: relayStylePagination(['type', 'approvalStatus']),
        },
      },
      Task: {
        fields: {
          comments: relayStylePagination(),
          activities: relayStylePagination(),
        },
      },
      Epic: {
        fields: {
          tasks: relayStylePagination(),
        },
      },
      // Computed, server-derived shapes with no id of their own: they belong to
      // their parent rather than being normalized as separate entities.
      ProjectAnalytics: { keyFields: ['projectId'] },
      UserAnalytics: { keyFields: ['userId'] },
      SprintMetrics: { keyFields: false },
      ProjectSettings: { keyFields: false },
    },
  });
}

export type CreateApolloClientOptions = {
  /** Called when a refresh fails — the user must sign in again. */
  onSessionExpired?: SessionExpiredHandler;
  /** Disables the socket, e.g. under test. */
  enableSubscriptions?: boolean;
};

export function createApolloClient(
  options: CreateApolloClientOptions = {},
): ApolloClient {
  const { onSessionExpired, enableSubscriptions = true } = options;

  // The handler needs the client, and the client needs the link that calls the
  // handler. A deferred reference is what breaks that cycle.
  let client: ApolloClient | null = null;

  const handleSessionExpired: SessionExpiredHandler = () => {
    clearAccessToken();
    // Nothing cached belongs to a signed-out user.
    void client?.clearStore();
    onSessionExpired?.();
  };

  const terminalLink =
    enableSubscriptions && typeof window !== 'undefined'
      ? ApolloLink.split(
          ({ query }) => {
            const definition = query.definitions[0];
            return (
              definition?.kind === 'OperationDefinition' &&
              definition.operation === 'subscription'
            );
          },
          createWsLink(),
          createHttpLink(),
        )
      : createHttpLink();

  client = new ApolloClient({
    /*
     * Order matters. Requests travel top-to-bottom, responses and errors back
     * up: normalization happens below the refresh link so the refresh link
     * only ever inspects an ApiError, and an operation that succeeds on replay
     * never surfaces an error at all.
     */
    link: ApolloLink.from([
      createAuthRefreshLink(handleSessionExpired),
      errorNormalizationLink,
      clientHeaderLink,
      terminalLink,
    ]),
    cache: createCache(),
    defaultOptions: {
      watchQuery: {
        // A stale list is worse than a brief spinner for task state.
        fetchPolicy: 'cache-and-network',
        nextFetchPolicy: 'cache-first',
      },
    },
  });

  return client;
}

export { ApiError };
