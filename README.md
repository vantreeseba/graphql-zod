# graphql-zod

A monorepo for the `@vantreeseba/graphql-zod` toolkit — build [Zod](https://zod.dev)
validation schemas from GraphQL typed documents.

## Packages

| Package | Description |
|---|---|
| [`@vantreeseba/graphql-zod`](./packages/graphql-zod) | The runtime: `inferZodSchema` builds a Zod schema for an operation's variables from a `TypedDocumentNode`, plus the `numericString` helper and the default scalar map. See its [README](./packages/graphql-zod/README.md). |
| [`@vantreeseba/graphql-zod-codegen`](./packages/graphql-zod-codegen) | A [graphql-codegen](https://the-guild.dev/graphql/codegen) plugin that emits `{Name}{Type}VariablesSchema` / `{Name}{Type}ResultSchema` for every named operation. See its [README](./packages/graphql-zod-codegen/README.md). |

The generated codegen output imports `numericString` from the runtime package, so
consumers install both: `@vantreeseba/graphql-zod` as a runtime dependency and
`@vantreeseba/graphql-zod-codegen` as a dev dependency.

## Development

This is an npm-workspaces monorepo.

```bash
npm install
npm run build        # build every package to its dist/
npm test             # test every package
npm run typecheck    # type-check every package
npm run typecheck:tests
npm run check        # biome lint + format check (whole repo)
```

Run a script in a single package with `-w`:

```bash
npm run test -w packages/graphql-zod-codegen
```

The core builds before the codegen plugin (alphabetical workspace order), so the
plugin's `tsc` resolves the runtime package's types from its built `dist/`.
