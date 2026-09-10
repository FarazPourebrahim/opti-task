import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural invariants of the token scales. These catch the mistakes that are
 * invisible in a browser: a blur tier that duplicates its base tier, a scale
 * that stops ascending, or an adjective-named token sneaking in.
 */
function read(file: string): string {
  return readFileSync(join(process.cwd(), 'src/shared/styles', file), 'utf8');
}

function tokensOf(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of declarations.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] && m[2] && !out.has(m[1])) out.set(m[1], m[2].trim());
  }
  return out;
}

const shadows = tokensOf(read('shadows.css'));
const measures = tokensOf(read('measures.css'));
const typography = tokensOf(read('typography.css'));
const animations = tokensOf(read('animations.css'));

/** Compares rem/px/s values so a scale can be checked for monotonicity. */
function toNumber(value: string): number {
  const m = value.match(/^(-?[\d.]+)(rem|px|em|s|ms)?$/);
  if (!m?.[1]) throw new Error(`Not a scalar token value: ${value}`);
  const n = Number(m[1]);
  if (m[2] === 'ms') return n / 1000;
  return n;
}

describe('shadow scales', () => {
  const steps = ['100', '300', '400', '500', '600'] as const;

  it.each(steps)(
    'blur tier %s differs from its base tier — an identical value is a bug',
    (step) => {
      const base = shadows.get(`--shadow-${step}`);
      const blur = shadows.get(`--shadow-blur-${step}`);

      expect(base, `--shadow-${step} is missing`).toBeDefined();
      expect(blur, `--shadow-blur-${step} is missing`).toBeDefined();
      expect(blur).not.toBe(base);
    },
  );

  it.each(steps)('blur tier %s spreads wider than its base tier', (step) => {
    // box-shadow is `<x> <y> <blur> <color>`; the x offset is written unitless
    // as `0`, so split on whitespace rather than matching a `px` suffix.
    const blurRadius = (value: string): number => {
      const lengths = value.slice(0, value.indexOf('var(')).trim().split(/\s+/);
      const blurToken = lengths[2];
      if (!blurToken) throw new Error(`No blur radius in: ${value}`);
      return Number(blurToken.replace('px', ''));
    };

    const base = blurRadius(shadows.get(`--shadow-${step}`)!);
    const blur = blurRadius(shadows.get(`--shadow-blur-${step}`)!);
    expect(blur).toBeGreaterThan(base);
  });

  it('defines a single shared focus ring', () => {
    expect(shadows.has('--shadow-focus')).toBe(true);
  });
});

describe('numeric scales ascend', () => {
  const cases: Array<[string, Map<string, string>, string[]]> = [
    [
      'font size',
      typography,
      ['100', '200', '300', '400', '500', '600', '700', '800', '900'].map(
        (s) => `--fs-${s}`,
      ),
    ],
    [
      'spacing',
      measures,
      ['100', '200', '300', '400', '500', '600', '700', '800', '900'].map(
        (s) => `--space-${s}`,
      ),
    ],
    [
      'border radius',
      measures,
      ['100', '200', '300', '400', '500', '600'].map((s) => `--br-${s}`),
    ],
    [
      'animation duration',
      animations,
      ['100', '300', '500', '700', '900'].map((s) => `--animation-duration-${s}`),
    ],
  ];

  it.each(cases)('%s increases at every step', (_label, source, names) => {
    const values = names.map((name) => {
      const raw = source.get(name);
      expect(raw, `${name} is missing`).toBeDefined();
      return toNumber(raw!);
    });

    for (let i = 1; i < values.length; i += 1) {
      expect(
        values[i]!,
        `${names[i]} (${values[i]}) must exceed ${names[i - 1]} (${values[i - 1]})`,
      ).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe('scale hygiene', () => {
  it('uses numeric steps, never adjective names', () => {
    const banned = /--(?:fs|space|br|shadow|animation-duration)-(?:xs|sm|md|lg|xl|fast|slow|small|large|tiny|huge)\b/;

    for (const file of [
      'typography.css',
      'measures.css',
      'shadows.css',
      'animations.css',
    ]) {
      expect(read(file), `${file} uses an adjective-named token`).not.toMatch(
        banned,
      );
    }
  });

  it('collapses every duration under prefers-reduced-motion', () => {
    const css = read('animations.css');
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\)([\s\S]*)$/,
    );

    expect(block).not.toBeNull();
    // Every duration token must be overridden, or a component animating on a
    // missed token keeps moving for users who asked it not to.
    for (const step of ['100', '300', '500', '700', '900']) {
      expect(block![1]).toContain(`--animation-duration-${step}`);
    }
  });
});
