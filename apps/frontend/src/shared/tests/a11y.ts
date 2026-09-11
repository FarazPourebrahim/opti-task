import { axe } from 'jest-axe';

/**
 * One accessibility audit configuration for every component test.
 *
 * Two rules are disabled, both because they describe a whole page rather than
 * an isolated component. Everything else stays on.
 *
 * - `region`: requires all content to sit inside a landmark. A component
 *   rendered on its own has no page landmarks; the app shell supplies them
 *   (Phase 5), and the full-route sweep in Phase 14 audits with this rule ON.
 * - `aria-hidden-focus`: fires on Radix's focus sentinels
 *   (`span[data-radix-focus-guard]`) — intentionally focusable, zero-size,
 *   pointer-events:none elements that implement the focus trap. They are
 *   library internals that exist only while a layer is open and are never
 *   reachable by a user.
 */
const COMPONENT_AUDIT_RULES = {
  region: { enabled: false },
  'aria-hidden-focus': { enabled: false },
} as const;

export async function auditA11y(container: Element) {
  return axe(container, { rules: { ...COMPONENT_AUDIT_RULES } });
}
