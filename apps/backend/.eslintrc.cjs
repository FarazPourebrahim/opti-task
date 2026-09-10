/* ESLint config — enforces docs/coding-style.md conventions. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Backend logging goes through the shared pino logger, never stdout
    // directly — a `console.log` bypasses redaction and structure.
    'no-console': 'error',
    // No `any` outside documented `// BOUNDARY:` escapes.
    '@typescript-eslint/no-explicit-any': 'error',
    // Prefer `type` over `interface` (coding-style.md).
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.cjs'],
};