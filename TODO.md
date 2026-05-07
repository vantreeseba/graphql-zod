# TODO

## Deferred from initial spec

- **Recursive nested input type resolution** — currently, non-scalar types (e.g., `CreateUserInput`) fall back to `z.any()` with a warning. Future: resolve nested input object shapes and generate fully typed nested Zod objects.

- **Enum support** — currently, GraphQL enum variables fall back to `z.string()`. Future: generate `z.enum([...values])` using the enum definitions from the schema or codegen output.

- **Result/response type schemas in runtime mode** — currently, runtime mode is variables-only. Future: accept the full schema at runtime to also generate Zod schemas for query result shapes.
