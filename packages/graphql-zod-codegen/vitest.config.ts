import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The plugin imports shared building blocks (defaultScalarCodeMap, resolveTypeInfo)
// from the @vantreeseba/graphql-zod runtime package. Alias it to the sibling
// package's source so tests run against source without a build step.
const graphqlZodSrc = fileURLToPath(new URL('../graphql-zod/src/index.ts', import.meta.url));

// graphql throws "another module or realm" when it is loaded more than once.
// Under vitest's SSR loader (plus @graphql-codegen/core) the package can be pulled
// in as both CJS and ESM, so dedupe it to a single instance and inline it.
export default defineConfig({
  resolve: {
    dedupe: ['graphql'],
    alias: {
      '@vantreeseba/graphql-zod': graphqlZodSrc,
    },
  },
  test: {
    server: {
      deps: {
        inline: ['graphql'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
