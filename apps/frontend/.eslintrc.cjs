/* ESLint config — enforces the working agreement for the React SPA. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.eslint.json', './e2e/tsconfig.json'],
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  settings: {
    react: { version: 'detect' },
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
    },
  },
  env: {
    browser: true,
    es2022: true,
  },
  rules: {
    // Nothing goes to the browser console in shipped code.
    'no-console': 'error',
    // No `any` outside documented `// BOUNDARY:` escapes.
    '@typescript-eslint/no-explicit-any': 'error',
    // Prefer `type` over `interface` (working agreement).
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    // alert()/prompt()/confirm() are banned — Toast and ConfirmDialog exist.
    'no-alert': 'error',
    // Colors come from theme tokens. An arbitrary value (`text-[#123456]`) or
    // an inline `style` color is how a design system drifts, one screen at a
    // time, and nothing else would notice.
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'Literal[value=/-\\[(#|rgb|hsl|oklch|oklab|color\\()/], TemplateElement[value.raw=/-\\[(#|rgb|hsl|oklch|oklab|color\\()/]',
        message:
          'Use a theme token (e.g. text-text-subtle, bg-primary), not an arbitrary color value.',
      },
      {
        selector:
          "JSXAttribute[name.name='style'] Property[key.name=/^(color|background|backgroundColor|borderColor|fill|stroke)$/]",
        message: 'Set colors with a token class, not an inline style.',
      },
    ],
    // `@/…` is app-internal, `@contracts` is a workspace package. Never reach
    // across the app boundary with a relative path.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../../../*', '../../packages/*'],
            message:
              'Cross-app imports must use the @contracts package specifier, not a relative path.',
          },
        ],
      },
    ],
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        pathGroups: [
          { pattern: '@contracts', group: 'external', position: 'after' },
          { pattern: '@/**', group: 'internal' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'never',
      },
    ],
  },
  overrides: [
    {
      // The test harness may log setup failures; nothing else may.
      files: ['src/shared/tests/**/*.{ts,tsx}'],
      rules: { 'no-console': 'off' },
    },
  ],
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/', '*.cjs'],
};
