# @vantreeseba/graphql-zod

Builds Zod validation schemas from GraphQL typed documents. Two modes: runtime and codegen plugin.

## Install

```bash
npm install @vantreeseba/graphql-zod
# peer deps
npm install graphql zod
```

---

## Runtime usage

Pass a `TypedQueryDocumentNode` (from graphql-codegen) to get a Zod schema for its variables.

```ts
import { inferZodSchema } from '@vantreeseba/graphql-zod';
import { GetUserDocument } from './__generated__/graphql';

const schema = inferZodSchema(GetUserDocument);
schema.parse(variables); // throws ZodError on invalid input
```

### Options

```ts
const schema = inferZodSchema(GetUserDocument, {
  // Override scalar mappings
  scalars: {
    DateTime: z.string().datetime(),
  },
  // Replace individual fields wholesale
  overrides: {
    email: z.string().email(),
    age: z.number().int().refine((n) => n >= 18),
  },
});
```

### Default scalar map

| GraphQL | Zod |
|---|---|
| `String` / `ID` | `z.string()` |
| `Boolean` | `z.boolean()` |
| `Int` | `numericString(z.number().int().safe())` |
| `Float` / `Decimal` | `numericString(z.number().safe())` |
| `DateTime` / `DateTimeISO` | `z.date()` |
| `JSONObject` | `z.record(z.string(), z.unknown())` |
| `Upload` | `z.any()` |
| Unknown types | `z.any()` + `console.warn` |

Non-null `String`/`ID` fields (except those named `id`) automatically get `.min(1)`.

### Utilities

```ts
import { numericString } from '@vantreeseba/graphql-zod';

// Coerces string or number input to a number before validating
const schema = numericString(z.number().int().positive());
schema.parse('42'); // → 42
```

---

## Codegen plugin

Add to your `codegen.ts` / `codegen.yml`. Generates `{Name}{Type}VariablesSchema` and `{Name}{Type}ResultSchema` for every named operation.

### `codegen.ts`

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'schema.graphql',
  documents: 'src/**/*.graphql',
  generates: {
    'src/__generated__/zod-schemas.ts': {
      plugins: ['@vantreeseba/graphql-zod'],
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

---

## Notes

- Unknown/object input types (e.g. `CreateUserInput`) fall back to `z.any()` — see `TODO.md`
- Enums fall back to `z.string()` — see `TODO.md`
- Result types are codegen-only; runtime mode is variables-only
