import { useApolloClient, useSubscription } from '@apollo/client/react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ApolloClient, OperationVariables } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  getRealtimeStatus,
  onRealtimeGapClosed,
  subscribeToRealtimeStatus,
} from '@/shared/services/realtime.client';
import type { RealtimeStatus } from '@/shared/services/realtime.client';
import { onRealtimeEvent } from '@/shared/services/realtime.events';
import type {
  RealtimeAppEvents,
  RealtimeAppTopic,
} from '@/shared/services/realtime.events';

type RealtimeSubscriptionOptions<TData, TVariables> = {
  variables: TVariables;
  skip?: boolean | undefined;
  /** Reconciles the cache with one event. It must not write anything else. */
  onEvent: (data: TData, client: ApolloClient) => void;
};

/**
 * Holds one subscription open and hands each event to a reconciler.
 *
 * The write source of truth is always a mutation. A subscription only brings
 * the cache up to date with a change made elsewhere, so its result is never
 * written to the cache automatically (`no-cache`): the reconciler decides, and
 * an event about something this client has not loaded is dropped rather than
 * filed as a half-known entity.
 *
 * A failure is deliberately silent. Realtime is an enhancement: a subscription
 * the server refuses, or a socket that is down, leaves the screen working
 * exactly as it does without it.
 */
export function useRealtimeSubscription<
  TData,
  TVariables extends OperationVariables,
>(
  document: TypedDocumentNode<TData, TVariables>,
  {
    variables,
    skip = false,
    onEvent,
  }: RealtimeSubscriptionOptions<TData, TVariables>,
): void {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  // BOUNDARY: Apollo types the options as a conditional tuple that cannot be
  // satisfied for a generic `TVariables`; the shape below is the documented one.
  const options = {
    variables,
    skip,
    fetchPolicy: 'no-cache',
    ignoreResults: true,
    onData: ({ client, data }: useSubscription.OnDataOptions<TData>) => {
      const event = data.data;
      if (event !== undefined && event !== null) {
        handler.current(event as TData, client);
      }
    },
    onError: () => undefined,
  } as unknown as useSubscription.Options<TData, OperationVariables>;

  useSubscription<TData, OperationVariables>(document, options);
}

/** Runs a handler for each realtime event passed on inside the app. */
export function useRealtimeEvent<Topic extends RealtimeAppTopic>(
  topic: Topic,
  onEvent: (event: RealtimeAppEvents[Topic]) => void,
): void {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(
    () => onRealtimeEvent(topic, (event) => handler.current(event)),
    [topic],
  );
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    subscribeToRealtimeStatus,
    getRealtimeStatus,
    getRealtimeStatus,
  );
}

/**
 * Catches up after a gap.
 *
 * Events sent while the socket was down are gone — the server keeps no backlog.
 * When the connection returns, every query on screen is re-read, so what is
 * shown is current again rather than quietly stale.
 */
export function useRealtimeCatchUp(): void {
  const client = useApolloClient();

  useEffect(
    () =>
      onRealtimeGapClosed(() => {
        void client.reFetchObservableQueries();
      }),
    [client],
  );
}
