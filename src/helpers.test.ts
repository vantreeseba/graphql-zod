import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { numericString, toStartCase } from './helpers.js';

describe('numericString', () => {
  const schema = numericString(z.number().int().safe());

  it('passes through a number', () => {
    expect(schema.parse(42)).toBe(42);
  });

  it('coerces a numeric string to a number', () => {
    expect(schema.parse('7')).toBe(7);
  });

  it('coerces an unparseable string to 0', () => {
    expect(schema.parse('abc')).toBe(0);
  });

  it('coerces null-ish to 0', () => {
    expect(schema.parse(null)).toBe(0);
    expect(schema.parse(undefined)).toBe(0);
  });

  it('applies downstream zod validations', () => {
    const intSchema = numericString(z.number().int().min(1));
    expect(() => intSchema.parse(0)).toThrow();
    expect(intSchema.parse('5')).toBe(5);
  });

  it('works with float schema', () => {
    const floatSchema = numericString(z.number().safe());
    expect(floatSchema.parse('3.14')).toBe(3);
    expect(floatSchema.parse(3.14)).toBe(3.14);
  });
});

describe('toStartCase', () => {
  it('converts camelCase', () => {
    expect(toStartCase('firstName')).toBe('First Name');
  });

  it('converts a single lowercase word', () => {
    expect(toStartCase('email')).toBe('Email');
  });

  it('handles PascalCase', () => {
    expect(toStartCase('UserId')).toBe('User Id');
  });

  it('handles already single word', () => {
    expect(toStartCase('id')).toBe('Id');
  });
});
