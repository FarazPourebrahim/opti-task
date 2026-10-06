import { test as base } from '@playwright/test';
import { noteRequest, waitForBudget } from './pace';

/** Requests a test may make before the suite has to wait for it. */
const ROOM_FOR_ONE_TEST = 80;

/**
 * The suite's `test`: Playwright's own, plus pacing against the backend's rate
 * limit. Every spec imports `test` and `expect` from here.
 */
export const test = base.extend<{ pacing: undefined }>({
  pacing: [
    async ({ context }, use) => {
      // A test starts with most of a minute's allowance ahead of it.
      await waitForBudget(ROOM_FOR_ONE_TEST);
      context.on('request', (request) => {
        if (request.url().endsWith('/graphql')) noteRequest();
      });
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
