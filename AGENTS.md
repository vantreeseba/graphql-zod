# AGENTS.md

## Project

An npm-workspaces monorepo for the `@vantreeseba/graphql-zod` toolkit — building
[Zod](https://zod.dev) validation schemas from GraphQL typed documents:

- **`packages/graphql-zod`** — the runtime: `inferZodSchema` builds a `z.ZodObject`
  for a `TypedDocumentNode`'s **variables** (no full schema needed at runtime). Also
  exports the `numericString` helper, the default scalar map, and the shared
  `resolveTypeInfo` / `VariableInfo` building blocks the codegen plugin consumes.
- **`packages/graphql-zod-codegen`** — a [graphql-codegen](https://the-guild.dev/graphql/codegen)
  plugin that emits `{Name}{Type}VariablesSchema` / `{Name}{Type}ResultSchema` for
  every named operation. Its generated output imports `numericString` from the runtime.

## Specifications

All feature requirements and API contracts are in [specifications.md](./specifications.md).
Deferred work is tracked in [TODO.md](./TODO.md).

## Stack

- **Language:** TypeScript 5, strict mode, ESM only
- **Monorepo:** npm workspaces; run scripts at root (delegates to packages via
  `--workspaces`) or target one with `-w packages/<name>`
- **Tests:** Vitest (`npm test`)
- **Formatting/linting:** Biome (`npm run check`) — single root config, whole repo
- **Build:** `tsc` per package (`npm run build`) — outputs to each package's `dist/`
- **graphql-zod peer deps:** `graphql >=16`, `zod >=3`
- **graphql-zod-codegen peer deps:** `@graphql-codegen/plugin-helpers >=7`, `graphql >=16`,
  `@vantreeseba/graphql-zod` (the runtime its generated code imports from, and where it
  imports `defaultScalarCodeMap` / `resolveTypeInfo`)
- **No lodash** — inline any string utilities needed

## Project structure

```
packages/
  graphql-zod/
    src/
      index.ts            — public API entry point (re-exports)
      inferZodSchema.ts   — runtime mode implementation (variables-only)
      scalars.ts          — default scalar map (Zod instances + code strings)
      helpers.ts          — exported utility helpers (numericString, toStartCase)
      typeResolver.ts     — shared VariableInfo + resolveTypeInfo (runtime & codegen)
    src/*.test.ts         — unit tests live alongside source
  graphql-zod-codegen/
    src/index.ts          — the graphql-codegen plugin export
    src/index.test.ts     — plugin output + config unit tests
    test/integration/     — end-to-end test through @graphql-codegen/core
    test/fixtures/        — schema.graphql + operations.graphql (+ generated output)
vitest.config.ts (per package) — dedupes/inlines graphql so it loads as a single instance;
  the codegen package also aliases @vantreeseba/graphql-zod to the runtime's source so
  tests run without a build step
```

## Key conventions

- Each package's exports go through its `src/index.ts`
- The runtime exposes `defaultScalarCodeMap`, `resolveTypeInfo`, and `VariableInfo` from
  its index so the codegen plugin can reuse them instead of duplicating logic — keep the
  scalar maps (`defaultScalarMap` / `defaultScalarCodeMap`) in sync in `scalars.ts`
- Unknown GraphQL types fall back to `z.any()` and emit `console.warn`
- Nullable fields get `.nullish()`; list fields get `.array()`
- Non-null string/ID fields with a name other than `id` get `.min(1)`
- User scalar overrides merge over the default map (user wins)
- User field overrides (runtime) replace generated types wholesale
- Tests live alongside source as `*.test.ts`; integration tests go under `test/integration/`

## Running locally

```bash
npm install
npm test        # vitest across all packages
npm run build   # compile every package to its dist/
npm run check   # biome lint + format check (whole repo)

npm run test -w packages/graphql-zod-codegen  # one package
```

The core package builds before the codegen plugin (alphabetical workspace order), so the
plugin's `tsc` resolves the runtime package's types from its built `dist/`.
