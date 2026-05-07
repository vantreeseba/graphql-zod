import type { ZodNumber } from 'zod';
import { z } from 'zod';

export const numericString = (schema: ZodNumber) =>
  z.preprocess((a) => {
    if (typeof a === 'string') return Number.parseInt(a, 10) || 0;
    if (typeof a === 'number') return a;
    return 0;
  }, schema);

export function toStartCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
