/**
 * Public surface of `@contracts` — the definitions shared across OptiTask apps.
 *
 * Everything exported here is pure and environment-neutral: types, enums and
 * plain constants only. Nothing in this package may import a Node-only (`fs`,
 * `process`) or browser-only (`window`, `document`) API, because it is compiled
 * into both the server bundle and the browser bundle.
 */

// Cross-app domain types & enums
export * from './types/domain.types.js';
export * from './types/rbac.types.js';

// API & event contracts
export * from './contracts/error.contract.js';
export * from './contracts/pagination.contract.js';
export * from './contracts/realtime.contract.js';
