/** The first reconnect waits this long; each one after waits twice as long. */
export const REALTIME_RETRY_BASE_MS = 1_000;

/** No reconnect waits longer than this, however many have failed. */
export const REALTIME_RETRY_CAP_MS = 30_000;

/** Up to this much is added at random, so clients do not return in step. */
export const REALTIME_RETRY_JITTER_MS = 1_000;

/** This many failed attempts in a row and the app says it is offline. */
export const REALTIME_OFFLINE_AFTER_FAILURES = 3;
