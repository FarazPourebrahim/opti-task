import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './support/test';
import { seedWorkspace } from './support/api';
import type { Workspace } from './support/api';
import {
  DESKTOP,
  PHONE,
  horizontalOverflow,
  settle,
  signIn,
  signedInRoutes,
  watchForProblems,
} from './support/app';

/*
 * Every screen, at a desktop and a phone width, against the real backend:
 * nothing the server refuses, nothing thrown, nothing wider than the window,
 * and no accessibility violation — with every rule on, landmarks and contrast
 * included, which the component suite cannot check.
 *
 * What is known to fail is named below, each with its cause. All of it is in
 * Avero's own palette or markup, so the fix is Avero's to make (see
 * known-debt, Phase 14). The sweep fails on anything that is NOT on this list.
 */

/** Text and background pairs Avero paints below the 4.5:1 that WCAG asks. */
const KNOWN_CONTRAST_PAIRS: Record<string, string> = {
  '#ffffff on #fe9a00':
    'white on the brand color (filled buttons, current tab)',
  '#6a7282 on #f4f4f4': 'gray-500 text on the page background',
  '#99a1af on #ffffff': 'empty-state text, `circle` and `text` variants',
  '#d1d5dc on #ffffff': 'empty-state text, `icon` variant',
  '#d1d5dc on #f9fafc': 'empty-state text, `icon` variant, on a muted surface',
  '#e17100 on #fff7ee': 'chip text on the brand tint',
};

/** Avero's table scrolls sideways on a phone but cannot take keyboard focus. */
const KNOWN_UNFOCUSABLE_SCROLLER = 'data-slot="table-container"';

type Violation = {
  id: string;
  route: string;
  target: string;
  html: string;
  /** For a contrast failure: the two colors and their ratio. */
  colors: string | null;
};

async function audit(page: Page, route: string): Promise<Violation[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();

  return violations.flatMap((violation) =>
    violation.nodes.map((node) => {
      const data = node.any[0]?.data as
        | { fgColor?: string; bgColor?: string; contrastRatio?: number }
        | undefined;

      return {
        id: violation.id,
        route,
        target: node.target.join(' '),
        html: node.html.slice(0, 160),
        colors: data?.fgColor
          ? `${data.fgColor} on ${data.bgColor} (${data.contrastRatio}:1)`
          : null,
      };
    }),
  );
}

/** Why a violation is expected, or null when it is not. */
function knownCause(violation: Violation): string | null {
  if (violation.id === 'color-contrast' && violation.colors) {
    const pair = violation.colors.split(' (')[0] ?? '';
    return KNOWN_CONTRAST_PAIRS[pair] ?? null;
  }
  if (
    violation.id === 'scrollable-region-focusable' &&
    violation.html.includes(KNOWN_UNFOCUSABLE_SCROLLER)
  ) {
    return 'table container is not focusable';
  }
  return null;
}

function unexpected(violations: Violation[]): Violation[] {
  return violations.filter((violation) => knownCause(violation) === null);
}

let workspace: Workspace;

test.beforeAll(async () => {
  workspace = await seedWorkspace();
});

for (const [label, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  test.describe(`every signed-in screen, ${label}`, () => {
    test.use({ viewport });

    test('loads cleanly, fits the window and passes the accessibility audit', async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);

      // Arrange
      await signIn(page, workspace.owner);
      const problems = watchForProblems(page);
      const all: Violation[] = [];

      for (const [name, path] of signedInRoutes(workspace)) {
        await test.step(name, async () => {
          // Act
          problems.length = 0;
          await page.goto(path);
          await settle(page);

          // Assert
          expect.soft(problems, `${name}: problems`).toEqual([]);
          expect
            .soft(await horizontalOverflow(page), `${name}: overflow in px`)
            .toBe(0);

          const violations = await audit(page, name);
          all.push(...violations);
          expect
            .soft(unexpected(violations), `${name}: accessibility violations`)
            .toEqual([]);
        });
      }

      // The full list, for whoever fixes the known ones upstream.
      await testInfo.attach(`accessibility-${label}.json`, {
        body: JSON.stringify(all, null, 2),
        contentType: 'application/json',
      });
      const counts = new Map<string, number>();
      for (const violation of all) {
        const cause = knownCause(violation);
        if (cause) counts.set(cause, (counts.get(cause) ?? 0) + 1);
      }
      for (const [cause, count] of counts) {
        testInfo.annotations.push({
          type: 'known accessibility failure (Avero)',
          description: `${cause}: ${count}`,
        });
      }
    });
  });
}

test.describe('the signed-out screens', () => {
  for (const [label, viewport] of [
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ] as const) {
    test(`fit the window and pass the accessibility audit, ${label}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);

      for (const path of ['/login', '/register', '/forgot-password']) {
        await test.step(path, async () => {
          // Act
          await page.goto(path);
          await settle(page);

          // Assert
          expect
            .soft(await horizontalOverflow(page), `${path}: overflow`)
            .toBe(0);
          const violations = await audit(page, path);
          expect
            .soft(unexpected(violations), `${path}: accessibility violations`)
            .toEqual([]);
        });
      }
    });
  }

  test('send a visitor to sign in, and back to the page they asked for', async ({
    page,
  }) => {
    // Arrange
    const target = `/projects/${workspace.projectId}/board`;

    // Act
    await page.goto(target);
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Email').fill(workspace.owner.email);
    await page.getByLabel('Password').fill('secret123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(
      page.getByRole('region', { name: 'Task board' }),
    ).toBeVisible();
  });
});
