# @vantreeseba/graphql-zod

The runtime for the graphql-zod toolkit: build a Zod validation schema for a GraphQL
operation's variables from a `TypedDocumentNode`, without needing the full schema at
runtime. For codegen-time schema generation (variables **and** result schemas), see
[`@vantreeseba/graphql-zod-codegen`](../graphql-zod-codegen).

## Install

```bash
npm install @vantreeseba/graphql-zod
# peer deps
npm install graphql zod
```

## Usage

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

## Notes

- Unknown/object input types (e.g. `CreateUserInput`) fall back to `z.any()` — see the repo `TODO.md`
- Enums fall back to `z.string()` — see the repo `TODO.md`
- Runtime mode is variables-only; result schemas are codegen-only (see
  [`@vantreeseba/graphql-zod-codegen`](../graphql-zod-codegen))
