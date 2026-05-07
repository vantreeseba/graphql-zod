# graphql-zod — Specifications

## Overview

`@vantreeseba/graphql-zod` is an ESM TypeScript library that automatically builds Zod validation schemas from GraphQL typed documents. It operates in two modes: **runtime** (consuming `TypedDocumentNode` objects directly) and **codegen** (generating a `schemas.ts` file from graphql-codegen output).

---

## Modes

### Runtime mode

Takes a `TypedDocumentNode` and returns a Zod schema for its **variable types** (input side only).

Does not require the full schema at runtime — only the document is needed.

Result type validation is out of scope for runtime mode (see TODO.md).

### Codegen mode

Consumes graphql-codegen output (a TypeScript types file). Produces a single `schemas.ts` file exporting one Zod schema per operation.

Assumes graphql-codegen has already been run and types are available.

---

## Public API

### `inferZodSchema(document, options?)`

```ts
import { inferZodSchema } from '@vantreeseba/graphql-zod';

const schema = inferZodSchema(MyQueryDocument, {
  scalars: { DateTime: z.string().datetime() },
  overrides: {
    userId: z.string().uuid(),
  },
});

schema.parse(variables);
```

**Parameters:**

- `document`: A `TypedDocumentNode` (query, mutation, or subscription — unified, no separate per-operation functions).
- `options.scalars` _(optional)_: User-supplied scalar map that **merges over** the default scalar map. Values are Zod types.
- `options.overrides` _(optional)_: Per-field Zod type replacements. Each value is a Zod type that **replaces** the generated schema for that field entirely. Users who need to extend rather than replace should compose via `z.and()` or `.refine()` on top of the generated type before passing it.

**Returns:** A `z.ZodObject` schema typed to the document's variable types.

---

### Exported utility helpers

```ts
import { numericString } from '@vantreeseba/graphql-zod';
```

- **`numericString(schema: ZodNumber): ZodType`** — preprocesses string or number inputs into a number before validating with the given `ZodNumber` schema. Useful for form inputs.

Additional helpers may be added as the library grows.

---

## Default Scalar Map

| GraphQL scalar | Zod type |
|---|---|
| `String` | `z.string()` |
| `ID` | `z.string()` |
| `Boolean` | `z.boolean()` |
| `Int` | `numericString(z.number().int().safe())` |
| `Float` | `numericString(z.number().safe())` |
| `DateTime` | `z.date()` |
| `DateTimeISO` | `z.date()` |
| `Decimal` | `numericString(z.number().safe())` |
| `JSONObject` | `z.record(z.string(), z.unknown())` |
| `Upload` | `z.any()` |

User-supplied `options.scalars` entries are merged over this map (user wins on conflict).

---

## Nullability & Arrays

- GraphQL nullable types → `.nullish()` applied to the Zod type.
- GraphQL list types → `.array()` applied to the Zod type.
- Non-null (`!`) types → no `.nullish()` wrapper; required `z.string()` fields also get `.min(1, { message })`.
- The `id` field name is always treated as non-min-length regardless of nullability (mirrors reference behavior).

---

## Error Handling

- Unknown or unmapped types (non-scalar, non-primitive) fall back to `z.any()` and emit a `console.warn` identifying the field name and unresolved type.
- No throws on unknown types.

---

## Codegen — graphql-codegen plugin

The codegen mode is exposed as a standard `graphql-codegen` plugin. Users add it to their `codegen.yml` / `codegen.ts` config alongside their other plugins.

**Plugin export:** `plugin` from `@vantreeseba/graphql-zod`.

**Plugin config:**
```yaml
# codegen.yml
generates:
  src/__generated__/schemas.ts:
    plugins:
      - '@vantreeseba/graphql-zod'
    config:
      scalars:
        DateTime: z.string().datetime()
```

The plugin receives the `GraphQLSchema` and all parsed `DocumentFile` objects from graphql-codegen automatically. No separate CLI or types file path is needed.

**Output per named operation:** two exports — variables schema and result schema.

```ts
// schemas.ts (generated — do not edit)
import { z } from 'zod';
import { numericString } from '@vantreeseba/graphql-zod';

export const GetUserQueryVariablesSchema = z.object({ id: z.string() });
export const GetUserQueryResultSchema = z.object({
  user: z.object({ id: z.string(), name: z.string() }).nullish(),
});

export const CreateUserMutationVariablesSchema = z.object({ input: z.any() }); // TODO: nested input
export const CreateUserMutationResultSchema = z.object({
  createUser: z.object({ id: z.string(), name: z.string() }),
});
```

**Naming convention:** `{OperationName}{OperationType}VariablesSchema` and `{OperationName}{OperationType}ResultSchema`.

Anonymous operations are skipped with no output.

---

## Non-goals (for now — see TODO.md)

- Recursive nested input type resolution.
- Enum-aware `z.enum([...])` generation.
- Result / response type schema generation in runtime mode.
- Watch mode for codegen.

---

## Tooling

| Tool | Purpose |
|---|---|
| TypeScript 5 | Language; strict mode enabled |
| Vitest | Unit tests |
| Biome | Formatting and linting |
| `graphql` | Peer dependency — AST parsing |
| `zod` | Peer dependency — schema building |

Output: ESM only (`"type": "module"`). Compatible with both browser and Node environments.

No lodash dependency — utilities are inlined.
