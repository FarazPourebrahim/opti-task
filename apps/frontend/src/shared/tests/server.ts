import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The single MSW server for the whole suite.
 *
 * Tests mock at the NETWORK boundary — never by mocking a service or hook
 * module. That keeps the Apollo link chain, error normalization and cache
 * behavior inside the code under test rather than stubbed away.
 */
export const server = setupServer(...handlers);
