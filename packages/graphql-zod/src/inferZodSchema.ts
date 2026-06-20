import { Kind, type TypedQueryDocumentNode } from 'graphql';
import type { ZodRawShape, ZodString, ZodTypeAny } from 'zod';
import { z } from 'zod';
import { toStartCase } from './helpers.js';
import { defaultScalarMap } from './scalars.js';
import { type VariableInfo, resolveTypeInfo } from './typeResolver.js';

type OverrideShape<TVariables> = Partial<{ [K in keyof TVariables]: ZodTypeAny }>;

type InferZodSchemaOptions<TVariables> = {
  scalars?: Record<string, ZodTypeAny>;
  overrides?: OverrideShape<TVariables>;
};

function buildZodType(info: VariableInfo, scalarMap: Record<string, ZodTypeAny>): ZodTypeAny {
  let zodType: ZodTypeAny;

  if (info.typeName in scalarMap) {
    zodType = scalarMap[info.typeName];

    if (
      !info.nullable &&
      info.name !== 'id' &&
      (info.typeName === 'String' || info.typeName === 'ID') &&
      zodType instanceof z.ZodString
    ) {
      zodType = (zodType as ZodString).min(1, { message: `${toStartCase(info.name)} is required` });
    }
  } else {
    console.warn(
      `[graphql-zod] Unknown type "${info.typeName}" for field "${info.name}" — falling back to z.any()`,
    );
    zodType = z.any();
  }

  if (info.nullable) zodType = zodType.nullish();
  if (info.array) zodType = zodType.array();

  return zodType;
}

export function inferZodSchema<TResult = unknown, TVariables = Record<string, unknown>>(
  document: TypedQueryDocumentNode<TResult, TVariables>,
  options?: InferZodSchemaOptions<TVariables>,
): z.ZodObject<ZodRawShape> {
  const firstDef = document.definitions[0];

  if (firstDef.kind !== Kind.OPERATION_DEFINITION || !firstDef.variableDefinitions?.length) {
    return z.object({});
  }

  const scalarMap: Record<string, ZodTypeAny> = { ...defaultScalarMap, ...options?.scalars };
  let shape: ZodRawShape = {};

  for (const varDef of firstDef.variableDefinitions) {
    const info: VariableInfo = {
      name: varDef.variable.name.value,
      nullable: true,
      array: false,
      typeName: '',
    };
    resolveTypeInfo(varDef.type, info);
    shape[info.name] = buildZodType(info, scalarMap);
  }

  if (options?.overrides) {
    shape = { ...shape, ...(options.overrides as ZodRawShape) };
  }

  return z.object(shape);
}
