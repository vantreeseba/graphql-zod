/**
 * Integration test: runs our graphql-codegen plugin through @graphql-codegen/core
 * against real .graphql fixture files, writes zod-schemas.ts to disk, and asserts
 * on the generated file content.
 */

import { codegen } from '@graphql-codegen/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'graphql';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { plugin } from '../../src/codegen/plugin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures');
const OUT_FILE = join(FIXTURES_DIR, '__generated__/zod-schemas.ts');

const schemaSDL = readFileSync(join(FIXTURES_DIR, 'schema.graphql'), 'utf-8');
const operationsSDL = readFileSync(join(FIXTURES_DIR, 'operations.graphql'), 'utf-8');

let generatedContent: string;

beforeAll(async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Let @graphql-codegen/core build the GraphQLSchema from the DocumentNode
  // internally so it uses a single graphql instance throughout.
  generatedContent = await codegen({
    documents: [{ document: parse(operationsSDL), location: 'operations.graphql' }],
    config: {},
    filename: OUT_FILE,
    schema: parse(schemaSDL),
    plugins: [{ 'graphql-zod': {} }],
    pluginMap: { 'graphql-zod': { plugin } },
    pluginContext: {},
  });

  writeFileSync(OUT_FILE, generatedContent, 'utf-8');

  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// File-level structure
// ---------------------------------------------------------------------------
describe('generated file structure', () => {
  it('produces non-empty output', () => {
    expect(generatedContent.length).toBeGreaterThan(0);
  });

  it('imports zod', () => {
    expect(generatedContent).toContain("import { z } from 'zod';");
  });

  it('imports numericString from the package', () => {
    expect(generatedContent).toContain("import { numericString } from '@vantreeseba/graphql-zod';");
  });

  it('exports a schema for every named operation (variables + result = 18 exports)', () => {
    const exports = [...generatedContent.matchAll(/^export const \w+/gm)];
    // 9 operations × 2 schemas each
    expect(exports.length).toBe(18);
  });
});

// ---------------------------------------------------------------------------
// GetUser query
// ---------------------------------------------------------------------------
describe('GetUser query', () => {
  it('exports GetUserQueryVariablesSchema', () => {
    expect(generatedContent).toContain('GetUserQueryVariablesSchema');
  });

  it('variables: id is z.string() with no min (named "id")', () => {
    const block = extractBlock(generatedContent, 'GetUserQueryVariablesSchema');
    expect(block).toContain('id: z.string()');
    expect(block).not.toContain('min(1');
  });

  it('exports GetUserQueryResultSchema', () => {
    expect(generatedContent).toContain('GetUserQueryResultSchema');
  });

  it('result: user is a nullable object', () => {
    const block = extractBlock(generatedContent, 'GetUserQueryResultSchema');
    expect(block).toContain('user: z.object(');
    expect(block).toContain('.nullish()');
  });

  it('result: non-null fields have no nullish', () => {
    const block = extractBlock(generatedContent, 'GetUserQueryResultSchema');
    expect(block).toContain('name: z.string()');
    expect(block).toContain('active: z.boolean()');
  });

  it('result: nullable Int field (age) gets nullish', () => {
    const block = extractBlock(generatedContent, 'GetUserQueryResultSchema');
    expect(block).toContain('numericString(z.number().int().safe()).nullish()');
  });

  it('result: nullable DateTime field (createdAt) gets nullish', () => {
    const block = extractBlock(generatedContent, 'GetUserQueryResultSchema');
    expect(block).toContain('z.date().nullish()');
  });

  it('result: nested Address object is generated', () => {
    const block = extractBlock(generatedContent, 'GetUserQueryResultSchema');
    expect(block).toContain('address: z.object(');
    expect(block).toContain('street: z.string()');
    expect(block).toContain('city: z.string()');
    expect(block).toContain('country: z.string()');
    expect(block).toContain('zip: z.string().nullish()');
  });

  it('result: address itself is nullable', () => {
    const block = extractBlock(generatedContent, 'GetUserQueryResultSchema');
    // address is nullable in schema
    expect(block).toMatch(/address: z\.object\([\s\S]+?\)\.nullish\(\)/);
  });
});

// ---------------------------------------------------------------------------
// ListUsers query
// ---------------------------------------------------------------------------
describe('ListUsers query', () => {
  it('variables: nullable Boolean and Int get nullish', () => {
    const block = extractBlock(generatedContent, 'ListUsersQueryVariablesSchema');
    expect(block).toContain('z.boolean().nullish()');
    expect(block).toContain('numericString(z.number().int().safe()).nullish()');
  });

  it('result: users is a non-null list (array without nullish)', () => {
    const block = extractBlock(generatedContent, 'ListUsersQueryResultSchema');
    expect(block).toContain('.array()');
    // The outer result should not be nullish (users: [User!]! is non-null list)
    expect(block).toMatch(/users: z\.object\([\s\S]+?\)\.array\(\)/);
  });
});

// ---------------------------------------------------------------------------
// GetPost query
// ---------------------------------------------------------------------------
describe('GetPost query', () => {
  it('result: nullable body field gets nullish', () => {
    const block = extractBlock(generatedContent, 'GetPostQueryResultSchema');
    expect(block).toContain('body: z.string().nullish()');
  });

  it('result: non-null published field', () => {
    const block = extractBlock(generatedContent, 'GetPostQueryResultSchema');
    expect(block).toContain('published: z.boolean()');
  });

  it('result: non-null createdAt field', () => {
    const block = extractBlock(generatedContent, 'GetPostQueryResultSchema');
    expect(block).toContain('createdAt: z.date()');
  });

  it('result: tags is a non-null string array', () => {
    const block = extractBlock(generatedContent, 'GetPostQueryResultSchema');
    expect(block).toContain('tags: z.string().array()');
  });

  it('result: nested author object', () => {
    const block = extractBlock(generatedContent, 'GetPostQueryResultSchema');
    expect(block).toContain('author: z.object(');
  });

  it('result: post is nullable (Query.post returns Post, nullable)', () => {
    const block = extractBlock(generatedContent, 'GetPostQueryResultSchema');
    expect(block).toContain('.nullish()');
  });
});

// ---------------------------------------------------------------------------
// CreateUser mutation
// ---------------------------------------------------------------------------
describe('CreateUser mutation', () => {
  it('exports CreateUserMutationVariablesSchema', () => {
    expect(generatedContent).toContain('CreateUserMutationVariablesSchema');
  });

  it('variables: unknown input type falls back to z.any()', () => {
    const block = extractBlock(generatedContent, 'CreateUserMutationVariablesSchema');
    expect(block).toContain('input: z.any()');
  });

  it('exports CreateUserMutationResultSchema', () => {
    expect(generatedContent).toContain('CreateUserMutationResultSchema');
  });

  it('result: createUser is a non-null User object (no nullish on outer)', () => {
    const block = extractBlock(generatedContent, 'CreateUserMutationResultSchema');
    expect(block).toContain('createUser: z.object(');
    // createUser returns User! — the outer object should not be nullish
    const outerLine = block.match(/createUser: z\.object\([\s\S]+?\)(\.nullish\(\))?/)?.[0] ?? '';
    expect(outerLine).not.toContain('.nullish()');
  });

  it('result: selected fields id, name, email, active', () => {
    const block = extractBlock(generatedContent, 'CreateUserMutationResultSchema');
    expect(block).toContain('id: z.string()');
    expect(block).toContain('name: z.string()');
    expect(block).toContain('email: z.string()');
    expect(block).toContain('active: z.boolean()');
  });
});

// ---------------------------------------------------------------------------
// UpdateUser mutation
// ---------------------------------------------------------------------------
describe('UpdateUser mutation', () => {
  it('variables: non-null id with no min (named "id")', () => {
    const block = extractBlock(generatedContent, 'UpdateUserMutationVariablesSchema');
    expect(block).toContain('id: z.string()');
    expect(block).not.toContain('min(1');
  });

  it('variables: nullable name and age get nullish', () => {
    const block = extractBlock(generatedContent, 'UpdateUserMutationVariablesSchema');
    expect(block).toContain('z.string().nullish()');
    expect(block).toContain('numericString(z.number().int().safe()).nullish()');
  });

  it('result: updateUser is a nullable User', () => {
    const block = extractBlock(generatedContent, 'UpdateUserMutationResultSchema');
    expect(block).toContain('updateUser: z.object(');
    expect(block).toContain('.nullish()');
  });
});

// ---------------------------------------------------------------------------
// DeleteUser mutation
// ---------------------------------------------------------------------------
describe('DeleteUser mutation', () => {
  it('result: deleteUser is Boolean (non-null)', () => {
    const block = extractBlock(generatedContent, 'DeleteUserMutationResultSchema');
    expect(block).toContain('deleteUser: z.boolean()');
    expect(block).not.toContain('z.boolean().nullish()');
  });
});

// ---------------------------------------------------------------------------
// UploadAvatar mutation
// ---------------------------------------------------------------------------
describe('UploadAvatar mutation', () => {
  it('variables: userId (ID!, not named "id") gets min(1)', () => {
    const block = extractBlock(generatedContent, 'UploadAvatarMutationVariablesSchema');
    expect(block).toContain("z.string().min(1, { message: 'User Id is required' })");
  });

  it('variables: file (Upload!) maps to z.any()', () => {
    const block = extractBlock(generatedContent, 'UploadAvatarMutationVariablesSchema');
    expect(block).toContain('file: z.any()');
  });

  it('result: uploadAvatar is a nullable User', () => {
    const block = extractBlock(generatedContent, 'UploadAvatarMutationResultSchema');
    expect(block).toContain('uploadAvatar: z.object(');
    expect(block).toContain('.nullish()');
  });
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
describe('OnUserUpdated subscription', () => {
  it('exports variables and result schemas', () => {
    expect(generatedContent).toContain('OnUserUpdatedSubscriptionVariablesSchema');
    expect(generatedContent).toContain('OnUserUpdatedSubscriptionResultSchema');
  });

  it('variables: id is z.string() (no min, named "id")', () => {
    const block = extractBlock(generatedContent, 'OnUserUpdatedSubscriptionVariablesSchema');
    expect(block).toContain('id: z.string()');
    expect(block).not.toContain('min(1');
  });

  it('result: userUpdated is a nullable User', () => {
    const block = extractBlock(generatedContent, 'OnUserUpdatedSubscriptionResultSchema');
    expect(block).toContain('userUpdated: z.object(');
    expect(block).toContain('.nullish()');
  });
});

describe('OnPostPublished subscription', () => {
  it('variables: authorId (ID!, not named "id") gets min(1)', () => {
    const block = extractBlock(generatedContent, 'OnPostPublishedSubscriptionVariablesSchema');
    expect(block).toContain("z.string().min(1, { message: 'Author Id is required' })");
  });

  it('result: has nested author object', () => {
    const block = extractBlock(generatedContent, 'OnPostPublishedSubscriptionResultSchema');
    expect(block).toContain('author: z.object(');
  });
});

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------
describe('generated file on disk', () => {
  it('file exists and matches the in-memory output', () => {
    const onDisk = readFileSync(OUT_FILE, 'utf-8');
    expect(onDisk).toBe(generatedContent);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the content of a single `export const <name> = ...;` block.
 * Works for both single-line and multi-line object schemas.
 */
function extractBlock(content: string, name: string): string {
  const start = content.indexOf(`export const ${name}`);
  if (start === -1) throw new Error(`Could not find export "${name}" in generated content`);

  // Find the matching closing semicolon by counting braces
  let depth = 0;
  let i = start;
  let started = false;

  while (i < content.length) {
    const ch = content[i];
    if (ch === '(' || ch === '{') { depth++; started = true; }
    if (ch === ')' || ch === '}') depth--;
    if (started && depth === 0 && ch === ';') return content.slice(start, i + 1);
    i++;
  }

  return content.slice(start);
}
