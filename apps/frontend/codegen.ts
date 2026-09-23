import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Generates typed documents from the backend's committed SDL.
 *
 * The schema is read from the file the backend publishes
 * (`pnpm run schema:print` regenerates it), not from a running server — so
 * codegen works offline and in CI, and a schema change arrives as a reviewable
 * diff rather than a surprise.
 *
 * Output is committed. CI re-runs this and fails if the result differs, which
 * catches an operation edited without regenerating.
 */
const config: CodegenConfig = {
  schema: '../backend/docs/api/schema.graphql',
  documents: ['src/**/*.operations.ts', 'src/**/*.fragments.ts'],
  ignoreNoDocuments: false,
  generates: {
    './src/shared/graphql/generated/': {
      preset: 'client',
      presetConfig: {
        // Fragment masking hides a fragment's fields from components that did
        // not ask for them. Off: it adds an unwrap call at every use site, and
        // the discipline it enforces is not worth that friction here.
        fragmentMasking: false,
      },
      config: {
        // The wire format of each custom scalar. `DateTime` is a string rather
        // than a Date because the API rejects date-only values and the client
        // must round-trip the exact instant — see shared/utils/date.utils.ts.
        scalars: {
          UUID: 'string',
          DateTime: 'string',
          JSON: 'Record<string, unknown>',
        },
        useTypeImports: true,
        skipTypename: false,
        enumsAsTypes: true,
        avoidOptionals: {
          field: false,
          inputValue: false,
        },
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
