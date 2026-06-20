# @vantreeseba/graphql-zod-codegen

A [graphql-codegen](https://the-guild.dev/graphql/codegen) plugin that emits Zod
validation schemas for every named operation in your typed documents. It generates a
`{Name}{Type}VariablesSchema` and a `{Name}{Type}ResultSchema` per operation.

The generated file imports `numericString` from the runtime package
[`@vantreeseba/graphql-zod`](../graphql-zod), so install both:

```bash
npm install --save-dev @vantreeseba/graphql-zod-codegen
npm install @vantreeseba/graphql-zod   # runtime — the generated code imports from it
# peer deps
npm install graphql zod
```

## Usage

Add the plugin to your `codegen.ts` / `codegen.yml`.

### `codegen.ts`

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'schema.graphql',
  documents: 'src/**/*.graphql',
  generates: {
    'src/__generated__/zod-schemas.ts': {
      plugins: ['@vantreeseba/graphql-zod-codegen'],
      config: {
        scalars: {
          DateTime: "z.string().datetime()",
        },
      },
    },
  },
};

export default config;
```

### Generated output

```ts
// src/__generated__/zod-schemas.ts
import { z } from 'zod';
import { numericString } from '@vantreeseba/graphql-zod';

export const GetUserQueryVariablesSchema = z.object({
  id: z.string(),
});

export const GetUserQueryResultSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    age: numericString(z.number().int().safe()).nullish(),
  }).nullish(),
});
```

### Plugin config

| Option | Type | Description |
|---|---|---|
| `scalars` | `Record<string, string>` | Override scalar mappings. Values are Zod expression strings. |

## Behavior

- Nullable GraphQL fields → `.nullish()`; list fields → `.array()`.
- Non-null `String`/`ID` fields → `.min(1)`, except fields named `id`.
- Anonymous operations are skipped.
- Unknown/unmapped types fall back to `z.any()` and emit a `console.warn`.
- Nested input object types and enums are not yet fully resolved (enums fall back to
  `z.string()`) — see the repo `TODO.md`.
