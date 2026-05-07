import type { Types } from '@graphql-codegen/plugin-helpers';
import { buildSchema, parse } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import { plugin } from './plugin.js';

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------
const TEST_SCHEMA_SDL = `
  scalar DateTime
  scalar JSONObject
  scalar Upload

  type Query {
    user(id: ID!): User
    users(active: Boolean): [User!]!
    post(id: ID!, includeDeleted: Boolean): Post
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, name: String, age: Int): User
    deleteUser(id: ID!): Boolean!
    uploadAvatar(userId: ID!, file: Upload!): User
  }

  type Subscription {
    userUpdated(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    email: String!
    age: Int
    active: Boolean!
    createdAt: DateTime
    metadata: JSONObject
    posts: [Post!]!
    address: Address
  }

  type Post {
    id: ID!
    title: String!
    body: String
    author: User!
    tags: [String!]!
  }

  type Address {
    street: String!
    city: String!
    country: String!
    zip: String
  }

  input CreateUserInput {
    name: String!
    email: String!
    age: Int
  }
`;

const schema = buildSchema(TEST_SCHEMA_SDL);

function makeDoc(sdl: string): Types.DocumentFile {
  return { document: parse(sdl), location: 'test.graphql' };
}

type SyncPluginOutput = string | { content: string; prepend?: string[]; append?: string[] };

function runPlugin(sdl: string, config: Record<string, unknown> = {}): string {
  const result = plugin(schema, [makeDoc(sdl)], config) as SyncPluginOutput;
  if (typeof result === 'string') return result;
  const parts = [
    ...(result.prepend ?? []),
    result.content,
    ...(result.append ?? []),
  ];
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Plugin output structure
// ---------------------------------------------------------------------------
describe('plugin — output structure', () => {
  it('includes zod import in prepend', () => {
    const result = plugin(schema, [], {}) as SyncPluginOutput;
    expect(typeof result).toBe('object');
    const obj = result as { prepend?: string[] };
    expect(obj.prepend).toContain("import { z } from 'zod';");
  });

  it('includes numericString import in prepend', () => {
    const result = plugin(schema, [], {}) as SyncPluginOutput;
    const obj = result as { prepend?: string[] };
    expect(obj.prepend?.join('\n')).toContain('numericString');
  });

  it('skips anonymous operations', () => {
    const output = runPlugin('query { users { id } }');
    expect(output).not.toContain('Schema =');
  });
});

// ---------------------------------------------------------------------------
// Variables schemas — queries
// ---------------------------------------------------------------------------
describe('plugin — query variables', () => {
  it('generates a variables schema for a query', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { id name } }');
    expect(output).toContain('GetUserQueryVariablesSchema');
    expect(output).toContain('z.string()');
  });

  it('non-null String variable gets min(1)', () => {
    const output = runPlugin('query Search($term: String!) { users { id } }');
    expect(output).toContain('SearchQueryVariablesSchema');
    expect(output).toContain('.min(1');
  });

  it('nullable variable gets .nullish()', () => {
    const output = runPlugin('query ListUsers($active: Boolean) { users { id } }');
    expect(output).toContain('nullish()');
  });

  it('array variable gets .array()', () => {
    const output = runPlugin('query Bulk($ids: [ID!]!) { users { id } }');
    expect(output).toContain('.array()');
  });

  it('Int variable uses numericString', () => {
    const output = runPlugin('mutation UpdateAge($id: ID!, $age: Int) { updateUser(id: $id, age: $age) { id } }');
    expect(output).toContain('numericString(z.number().int().safe())');
  });

  it('Float variable uses numericString', () => {
    const output = runPlugin('query Q($price: Float!) { users { id } }');
    expect(output).toContain('numericString(z.number().safe())');
  });

  it('Boolean variable maps to z.boolean()', () => {
    const output = runPlugin('query ListUsers($active: Boolean) { users { id } }');
    expect(output).toContain('z.boolean()');
  });

  it('DateTime variable maps to z.date()', () => {
    const output = runPlugin('query Q($at: DateTime!) { users { id } }');
    expect(output).toContain('z.date()');
  });

  it('no variables produces z.object({})', () => {
    const output = runPlugin('query GetAllUsers { users { id } }');
    expect(output).toContain('z.object({})');
  });
});

// ---------------------------------------------------------------------------
// Variables schemas — mutations
// ---------------------------------------------------------------------------
describe('plugin — mutation variables', () => {
  it('generates a variables schema for a mutation', () => {
    const output = runPlugin(
      'mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }',
    );
    expect(output).toContain('CreateUserMutationVariablesSchema');
  });

  it('unknown input type falls back to z.any() with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const output = runPlugin(
      'mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }',
    );
    expect(output).toContain('z.any()');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('CreateUserInput'));
    warnSpy.mockRestore();
  });

  it('non-null String variable gets min(1)', () => {
    const output = runPlugin('mutation DeleteUser($id: ID!, $reason: String!) { deleteUser(id: $id) }');
    expect(output).toContain("min(1, { message: 'Reason is required' })");
  });

  it('generates both variables and result schemas', () => {
    const output = runPlugin(
      'mutation DeleteUser($id: ID!) { deleteUser(id: $id) }',
    );
    expect(output).toContain('DeleteUserMutationVariablesSchema');
    expect(output).toContain('DeleteUserMutationResultSchema');
  });
});

// ---------------------------------------------------------------------------
// Variables schemas — subscriptions
// ---------------------------------------------------------------------------
describe('plugin — subscription variables', () => {
  it('generates schemas for subscription operations', () => {
    const output = runPlugin('subscription OnUserUpdated($id: ID!) { userUpdated(id: $id) { id name } }');
    expect(output).toContain('OnUserUpdatedSubscriptionVariablesSchema');
    expect(output).toContain('OnUserUpdatedSubscriptionResultSchema');
  });
});

// ---------------------------------------------------------------------------
// Result schemas — scalar fields
// ---------------------------------------------------------------------------
describe('plugin — result schemas (scalars)', () => {
  it('maps String result field', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { name } }');
    expect(output).toContain('GetUserQueryResultSchema');
    expect(output).toContain('z.string()');
  });

  it('maps Int result field', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { age } }');
    expect(output).toContain('numericString(z.number().int().safe())');
  });

  it('maps Boolean result field', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { active } }');
    expect(output).toContain('z.boolean()');
  });

  it('maps DateTime result field', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { createdAt } }');
    expect(output).toContain('z.date()');
  });

  it('nullable result field gets .nullish()', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { age } }');
    // age is Int (nullable), user itself is User (nullable)
    expect(output).toContain('.nullish()');
  });

  it('non-null result field has no nullish', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { name active } }');
    // name and active are non-null — their lines should not have .nullish()
    expect(output).toContain('name: z.string()');
    expect(output).toContain('active: z.boolean()');
  });
});

// ---------------------------------------------------------------------------
// Result schemas — nested object types
// ---------------------------------------------------------------------------
describe('plugin — result schemas (nested objects)', () => {
  it('generates a nested z.object for a nested type', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { address { street city country zip } } }');
    expect(output).toContain('address: z.object(');
    expect(output).toContain('street: z.string()');
    expect(output).toContain('city: z.string()');
    expect(output).toContain('zip: z.string().nullish()');
  });

  it('generates a deeply nested schema (post.author.name)', () => {
    const output = runPlugin(
      'query GetPost($id: ID!) { post(id: $id) { title author { name email } } }',
    );
    expect(output).toContain('author: z.object(');
    expect(output).toContain('name: z.string()');
    expect(output).toContain('email: z.string()');
  });

  it('marks nullable nested object as nullish', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { address { city } } }');
    // address on User is Address (nullable)
    expect(output).toContain('.nullish()');
  });

  it('marks the top-level result as nullish when nullable', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { id } }');
    // user on Query is User (nullable)
    expect(output).toContain('.nullish()');
  });

  it('marks list result fields as .array()', () => {
    const output = runPlugin('query GetUser($id: ID!) { user(id: $id) { posts { id title } } }');
    expect(output).toContain('.array()');
  });
});

// ---------------------------------------------------------------------------
// Result schemas — mutation results
// ---------------------------------------------------------------------------
describe('plugin — result schemas (mutations)', () => {
  it('generates result schema for a mutation with object result', () => {
    const output = runPlugin(
      'mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id name email } }',
    );
    expect(output).toContain('CreateUserMutationResultSchema');
    expect(output).toContain('z.object(');
    expect(output).toContain('id: z.string()');
    expect(output).toContain('name: z.string()');
    expect(output).toContain('email: z.string()');
  });

  it('generates result schema for a mutation returning a scalar', () => {
    const output = runPlugin('mutation DeleteUser($id: ID!) { deleteUser(id: $id) }');
    expect(output).toContain('DeleteUserMutationResultSchema');
    expect(output).toContain('z.boolean()');
  });

  it('non-null mutation result has no top-level nullish', () => {
    const output = runPlugin(
      'mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }',
    );
    // createUser returns User! (non-null) — the result object itself is not nullish
    // id is ID! — no nullish
    expect(output).toContain('id: z.string()');
  });
});

// ---------------------------------------------------------------------------
// Multiple operations in one document
// ---------------------------------------------------------------------------
describe('plugin — multiple operations', () => {
  it('generates schemas for each named operation', () => {
    const output = runPlugin(`
      query GetUser($id: ID!) { user(id: $id) { name } }
      mutation DeleteUser($id: ID!) { deleteUser(id: $id) }
    `);
    expect(output).toContain('GetUserQueryVariablesSchema');
    expect(output).toContain('GetUserQueryResultSchema');
    expect(output).toContain('DeleteUserMutationVariablesSchema');
    expect(output).toContain('DeleteUserMutationResultSchema');
  });
});

// ---------------------------------------------------------------------------
// Custom scalar overrides via config
// ---------------------------------------------------------------------------
describe('plugin — custom scalar config', () => {
  it('replaces a built-in scalar with a user-provided code string', () => {
    const output = runPlugin('query Q($at: DateTime!) { users { id } }', {
      scalars: { DateTime: 'z.string().datetime()' },
    });
    expect(output).toContain('z.string().datetime()');
    expect(output).not.toContain('z.date()');
  });

  it('adds a custom scalar not in the default map', () => {
    const output = runPlugin('query Q($point: LatLng!) { users { id } }', {
      scalars: { LatLng: 'z.object({ lat: z.number(), lng: z.number() })' },
    });
    expect(output).toContain('z.object({ lat: z.number(), lng: z.number() })');
  });
});

// ---------------------------------------------------------------------------
// Multiple document files
// ---------------------------------------------------------------------------
describe('plugin — multiple document files', () => {
  it('processes all document files', () => {
    const docs: Types.DocumentFile[] = [
      makeDoc('query GetUser($id: ID!) { user(id: $id) { name } }'),
      makeDoc('mutation DeleteUser($id: ID!) { deleteUser(id: $id) }'),
    ];
    const result = plugin(schema, docs, {}) as SyncPluginOutput;
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('GetUserQueryVariablesSchema');
    expect(content).toContain('DeleteUserMutationVariablesSchema');
  });
});
