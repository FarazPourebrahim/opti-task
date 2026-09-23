/**
 * The token inventory the gallery renders.
 *
 * Listed explicitly rather than parsed from CSS at runtime: a token that is
 * defined but never added here shows up as a gap in the gallery, which is the
 * cue to add it deliberately.
 */

export const GRAYSCALE = [
  '--color-gray-100',
  '--color-gray-98',
  '--color-gray-95',
  '--color-gray-90',
  '--color-gray-80',
  '--color-gray-70',
  '--color-gray-60',
  '--color-gray-50',
  '--color-gray-40',
  '--color-gray-30',
  '--color-gray-20',
  '--color-gray-15',
  '--color-gray-10',
] as const;

export const SEMANTIC_FAMILIES = [
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
] as const;

export const SEMANTIC_VARIANTS = ['lighter', '', 'darker'] as const;

export const SURFACES = [
  '--color-surface-300',
  '--color-surface-400',
  '--color-surface-500',
  '--color-border-300',
  '--color-border-400',
  '--color-text-300',
  '--color-text-400',
] as const;

export const FONT_SIZES = [
  '--fs-100',
  '--fs-200',
  '--fs-300',
  '--fs-400',
  '--fs-500',
  '--fs-600',
  '--fs-700',
  '--fs-800',
  '--fs-900',
] as const;

export const SPACING = [
  '--space-100',
  '--space-200',
  '--space-300',
  '--space-400',
  '--space-500',
  '--space-600',
  '--space-700',
  '--space-800',
  '--space-900',
] as const;

export const RADII = [
  '--br-100',
  '--br-200',
  '--br-300',
  '--br-400',
  '--br-500',
  '--br-600',
] as const;

export const SHADOWS = [
  '--shadow-100',
  '--shadow-300',
  '--shadow-400',
  '--shadow-500',
  '--shadow-600',
  '--shadow-blur-100',
  '--shadow-blur-300',
  '--shadow-blur-400',
  '--shadow-blur-500',
  '--shadow-blur-600',
] as const;

export const DURATIONS = [
  '--animation-duration-100',
  '--animation-duration-300',
  '--animation-duration-500',
  '--animation-duration-700',
  '--animation-duration-900',
] as const;
