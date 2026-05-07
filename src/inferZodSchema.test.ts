import { parse } from 'graphql';
import type { TypedQueryDocumentNode } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { inferZodSchema } from './inferZodSchema.js';

// Cast parse output to a typed document for test convenience.
function doc<TResult = unknown, TVariables = Record<string, unknown>>(
  sdl: string,
): TypedQueryDocumentNode<TResult, TVariables> {
  return parse(sdl) as TypedQueryDocumentNode<TResult, TVariables>;
}

// ---------------------------------------------------------------------------
// Scalar type coverage
// ---------------------------------------------------------------------------
describe('inferZodSchema — scalars', () => {
  it('maps String to z.string()', () => {
    const schema = inferZodSchema(doc('query Q($name: String!) { x }'));
    expect(schema.shape.name).toBeInstanceOf(z.ZodString);
  });

  it('maps ID to z.string()', () => {
    const schema = inferZodSchema(doc('query Q($id: ID!) { x }'));
    // ID fields named "id" skip the min(1) check
    expect(schema.parse({ id: '' })).toMatchObject({ id: '' });
  });

  it('maps Boolean to z.boolean()', () => {
    const schema = inferZodSchema(doc('query Q($active: Boolean!) { x }'));
    expect(schema.parse({ active: true })).toMatchObject({ active: true });
    expect(() => schema.parse({ active: 'yes' })).toThrow();
  });

  it('maps Int — accepts number', () => {
    const schema = inferZodSchema(doc('query Q($count: Int!) { x }'));
    expect(schema.parse({ count: 5 })).toMatchObject({ count: 5 });
  });

  it('maps Int — coerces numeric string', () => {
    const schema = inferZodSchema(doc('query Q($count: Int!) { x }'));
    expect(schema.parse({ count: '3' })).toMatchObject({ count: 3 });
  });

  it('maps Float — coerces numeric string', () => {
    const schema = inferZodSchema(doc('query Q($price: Float!) { x }'));
    expect(schema.parse({ price: '9' })).toMatchObject({ price: 9 });
    expect(schema.parse({ price: 9.99 })).toMatchObject({ price: 9.99 });
  });

  it('maps DateTime to z.date()', () => {
    const schema = inferZodSchema(doc('query Q($at: DateTime!) { x }'));
    const now = new Date();
    expect(schema.parse({ at: now })).toMatchObject({ at: now });
    expect(() => schema.parse({ at: 'not-a-date' })).toThrow();
  });

  it('maps DateTimeISO to z.date()', () => {
    const schema = inferZodSchema(doc('query Q($at: DateTimeISO!) { x }'));
    expect(schema.parse({ at: new Date() })).toBeDefined();
  });

  it('maps JSONObject to a record schema', () => {
    const schema = inferZodSchema(doc('query Q($meta: JSONObject!) { x }'));
    expect(schema.parse({ meta: { key: 'value' } })).toBeDefined();
  });

  it('maps Upload to z.any()', () => {
    const schema = inferZodSchema(doc('query Q($file: Upload!) { x }'));
    expect(schema.parse({ file: new Blob() })).toBeDefined();
    expect(schema.parse({ file: null })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Nullability
// ---------------------------------------------------------------------------
describe('inferZodSchema — nullability', () => {
  it('nullable field accepts null', () => {
    const schema = inferZodSchema(doc('query Q($name: String) { x }'));
    expect(schema.parse({ name: null })).toMatchObject({ name: null });
    expect(schema.parse({ name: undefined })).toMatchObject({ name: undefined });
    expect(schema.parse({ name: 'Alice' })).toMatchObject({ name: 'Alice' });
  });

  it('non-null String field rejects null', () => {
    const schema = inferZodSchema(doc('query Q($name: String!) { x }'));
    expect(() => schema.parse({ name: null })).toThrow();
  });

  it('non-null String field (not id) enforces min(1)', () => {
    const schema = inferZodSchema(doc('query Q($name: String!) { x }'));
    expect(() => schema.parse({ name: '' })).toThrow();
    expect(schema.parse({ name: 'Alice' })).toMatchObject({ name: 'Alice' });
  });

  it('non-null String field named "id" skips min(1)', () => {
    const schema = inferZodSchema(doc('query Q($id: String!) { x }'));
    expect(schema.parse({ id: '' })).toMatchObject({ id: '' });
  });

  it('non-null ID field named "id" skips min(1)', () => {
    const schema = inferZodSchema(doc('query Q($id: ID!) { x }'));
    expect(schema.parse({ id: '' })).toMatchObject({ id: '' });
  });

  it('non-null ID field not named "id" enforces min(1)', () => {
    const schema = inferZodSchema(doc('query Q($userId: ID!) { x }'));
    expect(() => schema.parse({ userId: '' })).toThrow();
    expect(schema.parse({ userId: '123' })).toMatchObject({ userId: '123' });
  });
});

// ---------------------------------------------------------------------------
// Lists / arrays
// ---------------------------------------------------------------------------
describe('inferZodSchema — lists', () => {
  it('nullable list field → array', () => {
    const schema = inferZodSchema(doc('query Q($tags: [String]) { x }'));
    const result = schema.parse({ tags: ['a', 'b'] });
    expect(result).toMatchObject({ tags: ['a', 'b'] });
  });

  it('non-null list field → required array', () => {
    const schema = inferZodSchema(doc('query Q($tags: [String!]!) { x }'));
    expect(() => schema.parse({ tags: null })).toThrow();
    expect(schema.parse({ tags: ['a'] })).toMatchObject({ tags: ['a'] });
  });

  it('empty list is valid', () => {
    const schema = inferZodSchema(doc('query Q($ids: [ID!]!) { x }'));
    expect(schema.parse({ ids: [] })).toMatchObject({ ids: [] });
  });
});

// ---------------------------------------------------------------------------
// Multiple variables
// ---------------------------------------------------------------------------
describe('inferZodSchema — multiple variables', () => {
  it('handles multiple variables in a single operation', () => {
    const schema = inferZodSchema(
      doc('query Q($id: ID!, $name: String, $age: Int!, $active: Boolean!) { x }'),
    );
    const result = schema.parse({ id: '1', name: null, age: 30, active: true });
    expect(result).toMatchObject({ id: '1', name: null, age: 30, active: true });
  });
});

// ---------------------------------------------------------------------------
// Query vs Mutation vs Subscription
// ---------------------------------------------------------------------------
describe('inferZodSchema — operation types', () => {
  it('works with query operations', () => {
    const schema = inferZodSchema(doc('query GetUser($id: ID!) { user(id: $id) { name } }'));
    expect(schema.parse({ id: '1' })).toMatchObject({ id: '1' });
  });

  it('works with mutation operations', () => {
    const schema = inferZodSchema(
      doc('mutation CreateUser($name: String!, $email: String!) { createUser(name: $name) { id } }'),
    );
    expect(schema.parse({ name: 'Alice', email: 'alice@example.com' })).toBeDefined();
  });

  it('works with subscription operations', () => {
    const schema = inferZodSchema(
      doc('subscription OnUpdate($id: ID!) { userUpdated(id: $id) { name } }'),
    );
    expect(schema.parse({ id: '42' })).toMatchObject({ id: '42' });
  });

  it('returns an empty schema for a document with no variables', () => {
    const schema = inferZodSchema(doc('query GetUsers { users { id } }'));
    expect(schema.parse({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Custom scalar overrides
// ---------------------------------------------------------------------------
describe('inferZodSchema — custom scalar overrides', () => {
  it('replaces a built-in scalar with a user-supplied type', () => {
    const schema = inferZodSchema(doc('query Q($at: DateTime!) { x }'), {
      scalars: { DateTime: z.string().datetime() },
    });
    expect(schema.parse({ at: '2024-01-01T00:00:00Z' })).toBeDefined();
    expect(() => schema.parse({ at: new Date() })).toThrow();
  });

  it('adds a custom scalar not in the default map', () => {
    const schema = inferZodSchema(doc('query Q($point: LatLng!) { x }'), {
      scalars: { LatLng: z.object({ lat: z.number(), lng: z.number() }) },
    });
    expect(schema.parse({ point: { lat: 1, lng: 2 } })).toBeDefined();
  });

  it('user scalar wins over default', () => {
    const schema = inferZodSchema(doc('query Q($n: Int!) { x }'), {
      scalars: { Int: z.number().int().positive() },
    });
    expect(() => schema.parse({ n: -1 })).toThrow();
    expect(schema.parse({ n: 5 })).toMatchObject({ n: 5 });
  });
});

// ---------------------------------------------------------------------------
// Field overrides
// ---------------------------------------------------------------------------
describe('inferZodSchema — field overrides', () => {
  it('replaces a generated field wholesale', () => {
    const schema = inferZodSchema(doc('query Q($email: String!) { x }'), {
      overrides: { email: z.string().email() },
    });
    expect(() => schema.parse({ email: 'not-an-email' })).toThrow();
    expect(schema.parse({ email: 'a@b.com' })).toMatchObject({ email: 'a@b.com' });
  });

  it('override with .and() extends the generated type', () => {
    const base = z.string().min(1);
    const schema = inferZodSchema(doc('query Q($name: String!) { x }'), {
      overrides: { name: base.and(z.string().max(50)) },
    });
    expect(() => schema.parse({ name: 'a'.repeat(51) })).toThrow();
    expect(schema.parse({ name: 'Alice' })).toBeDefined();
  });

  it('override with .refine() adds custom logic', () => {
    const schema = inferZodSchema(doc('query Q($age: Int!) { x }'), {
      overrides: { age: z.number().int().refine((n) => n >= 18, { message: 'Must be 18+' }) },
    });
    expect(() => schema.parse({ age: 17 })).toThrow();
    expect(schema.parse({ age: 18 })).toMatchObject({ age: 18 });
  });

  it('multiple overrides can be combined', () => {
    const schema = inferZodSchema(doc('query Q($id: ID!, $email: String!) { x }'), {
      overrides: {
        id: z.string().uuid(),
        email: z.string().email(),
      },
    });
    expect(() => schema.parse({ id: 'not-uuid', email: 'a@b.com' })).toThrow();
    expect(schema.parse({ id: crypto.randomUUID(), email: 'a@b.com' })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Unknown / non-scalar (Object) types
// ---------------------------------------------------------------------------
describe('inferZodSchema — unknown types', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('falls back to z.any() for unknown object types', () => {
    const schema = inferZodSchema(doc('query Q($input: CreateUserInput!) { x }'));
    expect(schema.parse({ input: { name: 'Alice' } })).toBeDefined();
    expect(schema.parse({ input: null })).toBeDefined();
  });

  it('emits a console.warn for unknown types', () => {
    inferZodSchema(doc('query Q($input: CreateUserInput!) { x }'));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown type "CreateUserInput"'),
    );
  });
});
