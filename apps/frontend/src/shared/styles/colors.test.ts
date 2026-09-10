import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrast is an invariant of the palette, so it is asserted against the
 * stylesheet itself rather than eyeballed in a browser. Changing a token that
 * drops a pair below its WCAG AA floor fails the build.
 *
 * Thresholds: 4.5:1 for body text (1.4.3), 3:1 for UI component boundaries and
 * focus indicators (1.4.11).
 */
// Under jsdom `import.meta.url` is an http:// URL, so the file is resolved from
// the Vitest root (apps/frontend) instead.
const css = readFileSync(
  join(process.cwd(), 'src/shared/styles/colors.css'),
  'utf8',
);

type Tokens = Map<string, string>;

function blockOf(selector: string): Tokens {
  const found = css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  const out: Tokens = new Map();
  if (!found?.[1]) return out;
  for (const m of found[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] && m[2]) out.set(m[1], m[2].trim());
  }
  return out;
}

/** Prose mentions colors too — hygiene checks must read declarations only. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

const root = blockOf(':root');
const light = blockOf('body\\.light');
const dark = blockOf('body\\.dark');

function resolve(token: string, theme: Tokens): string {
  let value = theme.get(token) ?? root.get(token);
  if (!value) throw new Error(`Token ${token} is not defined`);

  for (let i = 0; i < 10; i += 1) {
    const ref = value.match(/^var\((--[\w-]+)\)$/);
    if (!ref?.[1]) break;
    const next = theme.get(ref[1]) ?? root.get(ref[1]);
    if (!next) throw new Error(`Token ${ref[1]} is not defined`);
    value = next;
  }

  return value;
}

function hslToRgb(value: string): [number, number, number] {
  const m = value.match(
    /hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/,
  );
  if (!m?.[1] || !m[2] || !m[3]) throw new Error(`Not an hsl() value: ${value}`);

  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  if (s === 0) return [l, l, l];

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };

  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

function contrast(a: string, b: string): number {
  const luminance = (value: string): number => {
    const [r, g, bl] = hslToRgb(value).map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    ) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };

  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS = [
  ['--color-text-400', '--color-surface-300'],
  ['--color-text-400', '--color-surface-400'],
  ['--color-text-400', '--color-surface-500'],
  ['--color-text-300', '--color-surface-300'],
  ['--color-text-300', '--color-surface-400'],
] as const;

const UI_PAIRS = [
  ['--color-border-400', '--color-surface-300'],
  ['--color-border-400', '--color-surface-500'],
  ['--color-focus-ring', '--color-surface-300'],
] as const;

const SEMANTIC_FAMILIES = [
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
] as const;

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, theme) => {
  it.each(TEXT_PAIRS)('%s on %s meets AA for text (4.5:1)', (fg, bg) => {
    expect(contrast(resolve(fg, theme), resolve(bg, theme))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('%s on %s meets AA for UI (3:1)', (fg, bg) => {
    expect(contrast(resolve(fg, theme), resolve(bg, theme))).toBeGreaterThanOrEqual(3);
  });
});

describe('semantic families', () => {
  it.each(SEMANTIC_FAMILIES)(
    '%s -opposite is readable on its base color',
    (family) => {
      const fg = resolve(`--color-${family}-opposite`, root);
      const bg = resolve(`--color-${family}`, root);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(SEMANTIC_FAMILIES)('%s defines all four variants', (family) => {
    expect(root.has(`--color-${family}-opposite`)).toBe(true);
    expect(root.has(`--color-${family}-lighter`)).toBe(true);
    expect(root.has(`--color-${family}`)).toBe(true);
    expect(root.has(`--color-${family}-darker`)).toBe(true);
  });

  it.each(SEMANTIC_FAMILIES)(
    '%s varies only lightness across its ramp',
    (family) => {
      // A family derives from ONE hue/saturation; only lightness moves.
      const ramp = ['-lighter', '', '-darker'].map((suffix) =>
        resolve(`--color-${family}${suffix}`, root),
      );
      const parsed = ramp.map((value) => {
        const m = value.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
        return { h: m?.[1], s: m?.[2], l: Number(m?.[3]) };
      });

      expect(new Set(parsed.map((p) => p.h)).size).toBe(1);
      expect(new Set(parsed.map((p) => p.s)).size).toBe(1);
      // lighter > base > darker
      expect(parsed[0]!.l).toBeGreaterThan(parsed[1]!.l);
      expect(parsed[1]!.l).toBeGreaterThan(parsed[2]!.l);
    },
  );
});

describe('palette hygiene', () => {
  it('uses comma-form hsl() consistently, never the space form', () => {
    // Mixing the two syntaxes in one file is banned by the working agreement.
    const spaceForm = declarations.match(/hsl\(\s*[\d.]+(deg)?\s+/g);
    expect(spaceForm).toBeNull();
  });

  it('defines every color as hsl() — no hex or rgb anywhere', () => {
    expect(declarations.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(declarations.match(/\brgba?\(/g)).toBeNull();
  });

  it('never redefines a raw hue inside a theme block', () => {
    // Themes remap roles onto the palette; they must not invent colors. The
    // translucent overlay is the one allowed exception (it needs an alpha).
    for (const [name, theme] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      for (const [token, value] of theme) {
        if (token === '--color-overlay' || token === 'color-scheme') continue;
        expect(
          value.startsWith('var('),
          `${name} theme defines ${token} as a raw value: ${value}`,
        ).toBe(true);
      }
    }
  });
});
