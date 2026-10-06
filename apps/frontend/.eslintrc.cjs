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
