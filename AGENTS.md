# AGENTS.md

## Project

`@vantreeseba/graphql-zod` — auto Zod validation schema builder from GraphQL typed documents.

## Specifications

All feature requirements and API contracts are in [specifications.md](./specifications.md).
Deferred work is tracked in [TODO.md](./TODO.md).

## Stack

- **Language:** TypeScript 5, strict mode, ESM only
- **Tests:** Vitest (`npm test`)
- **Formatting/linting:** Biome (`npm run check`)
- **Build:** `tsc` (`npm run build`) — outputs to `dist/`
- **Peer deps:** `graphql >=16`, `zod >=3`
- **No lodash** — inline any string utilities needed

## Project structure

```
src/
  index.ts              — public API entry point
  inferZodSchema.ts     — runtime mode implementation
  scalars.ts            — default scalar map (Zod instances + code strings)
  helpers.ts            — exported utility helpers (numericString, toStartCase)
  typeResolver.ts       — shared VariableInfo + resolveTypeInfo (runtime & codegen)
  codegen/
    plugin.ts           — graphql-codegen plugin export
```

## Key conventions

- All exports go through `src/index.ts`
- Unknown GraphQL types fall back to `z.any()` and emit `console.warn`
- Nullable fields get `.nullish()`; list fields get `.array()`
- Non-null string/ID fields with a name other than `id` get `.min(1)`
- User scalar overrides merge over the default map (user wins)
- User field overrides replace generated types wholesale
- Tests live alongside source as `*.test.ts` files

## Running locally

```bash
npm install
npm test        # run vitest
npm run build   # compile to dist/
npm run check   # biome lint + format check
```
