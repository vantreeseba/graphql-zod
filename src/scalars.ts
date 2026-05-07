import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
import { numericString } from './helpers.js';

export const defaultScalarMap: Record<string, ZodTypeAny> = {
  String: z.string(),
  ID: z.string(),
  Boolean: z.boolean(),
  Int: numericString(z.number().int().safe()),
  Float: numericString(z.number().safe()),
  Decimal: numericString(z.number().safe()),
  DateTime: z.date(),
  DateTimeISO: z.date(),
  JSONObject: z.record(z.string(), z.unknown()),
  Upload: z.any(),
};

// Code-string equivalents used by the codegen plugin.
export const defaultScalarCodeMap: Record<string, string> = {
  String: 'z.string()',
  ID: 'z.string()',
  Boolean: 'z.boolean()',
  Int: 'numericString(z.number().int().safe())',
  Float: 'numericString(z.number().safe())',
  Decimal: 'numericString(z.number().safe())',
  DateTime: 'z.date()',
  DateTimeISO: 'z.date()',
  JSONObject: 'z.record(z.string(), z.unknown())',
  Upload: 'z.any()',
};
