/**
 * A GraphQL Code Generator plugin that emits Zod validation schemas
 * (`<Op>VariablesSchema` / `<Op>ResultSchema`) for every named operation in your
 * typed documents. The generated file imports `numericString` from the runtime
 * library `@vantreeseba/graphql-zod`.
 *
 * @packageDocumentation
 */

import type { PluginFunction } from '@graphql-codegen/plugin-helpers';
import { type VariableInfo, defaultScalarCodeMap, resolveTypeInfo } from '@vantreeseba/graphql-zod';
import {
  type FieldNode,
  type GraphQLEnumType,
  type GraphQLInputObjectType,
  type GraphQLInputType,
  type GraphQLList,
  type GraphQLNamedType,
  type GraphQLNonNull,
  type GraphQLObjectType,
  type GraphQLOutputType,
  type GraphQLSchema,
  type GraphQLUnionType,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

// Cross-realm-safe helpers: graphql's built-in predicates and getNamedType use
// instanceof internally, which fails when CJS and ESM instances of the graphql
// package coexist in the same process (e.g. vitest transform + @graphql-codegen/core).
function isGqlNonNull(t: GraphQLOutputType): t is GraphQLNonNull<GraphQLOutputType> {
  return t.constructor.name === 'GraphQLNonNull';
}
function isGqlList(t: GraphQLOutputType): t is GraphQLList<GraphQLOutputType> {
  return t.constructor.name === 'GraphQLList';
}
function isGqlObjectType(t: GraphQLNamedType): t is GraphQLObjectType {
  return t.constructor.name === 'GraphQLObjectType';
}
function isGqlEnumType(t: GraphQLNamedType): t is GraphQLEnumType {
  return t.constructor.name === 'GraphQLEnumType';
}
function isGqlUnionType(t: GraphQLNamedType): t is GraphQLUnionType {
  return t.constructor.name === 'GraphQLUnionType';
}
function isGqlInputObjectType(t: GraphQLNamedType): t is GraphQLInputObjectType {
  return t.constructor.name === 'GraphQLInputObjectType';
}
function getGqlNamedType(type: GraphQLOutputType): GraphQLNamedType {
  let t: GraphQLOutputType = type;
  while (isGqlNonNull(t) || isGqlList(t)) {
    t = (t as GraphQLNonNull<GraphQLOutputType> | GraphQLList<GraphQLOutputType>).ofType;
  }
  return t as GraphQLNamedType;
}

type PluginConfig = {
  scalars?: Record<string, string>;
};

function toStartCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function resolveInputFieldCode(
  fieldName: string,
  fieldType: GraphQLInputType,
  scalarCodeMap: Record<string, string>,
  schema: GraphQLSchema,
): string {
  const asOut = fieldType as unknown as GraphQLOutputType;
  const nullable = !isGqlNonNull(asOut);
  const unwrapped = isGqlNonNull(asOut) ? asOut.ofType : asOut;
  const isList = isGqlList(unwrapped);
  const namedType = getGqlNamedType(asOut);

  let code: string;

  if (isGqlInputObjectType(namedType)) {
    code = buildInputTypeCode(namedType, scalarCodeMap, schema);
  } else if (namedType.name in scalarCodeMap) {
    code = scalarCodeMap[namedType.name];
    if (
      !nullable &&
      fieldName !== 'id' &&
      (namedType.name === 'String' || namedType.name === 'ID')
    ) {
      code = `${code}.min(1, { message: '${toStartCase(fieldName)} is required' })`;
    }
  } else {
    console.warn(
      `[graphql-zod] Unknown type "${namedType.name}" for field "${fieldName}" — falling back to z.any()`,
    );
    code = 'z.any()';
  }

  if (nullable) code = `${code}.nullish()`;
  if (isList) code = `${code}.array()`;

  return code;
}

function buildInputTypeCode(
  inputType: GraphQLInputObjectType,
  scalarCodeMap: Record<string, string>,
  schema: GraphQLSchema,
): string {
  const fields = inputType.getFields();
  const lines = Object.entries(fields).map(([fieldName, field]) => {
    const code = resolveInputFieldCode(fieldName, field.type, scalarCodeMap, schema);
    return `  ${fieldName}: ${code}`;
  });
  return `z.object({\n${lines.join(',\n')},\n})`;
}

function buildVariableCode(
  info: VariableInfo,
  scalarCodeMap: Record<string, string>,
  schema?: GraphQLSchema,
): string {
  let code: string;

  if (info.typeName in scalarCodeMap) {
    code = scalarCodeMap[info.typeName];

    if (
      !info.nullable &&
      info.name !== 'id' &&
      (info.typeName === 'String' || info.typeName === 'ID')
    ) {
      code = `${code}.min(1, { message: '${toStartCase(info.name)} is required' })`;
    }
  } else if (schema) {
    const gqlType = schema.getType(info.typeName);
    if (gqlType && isGqlInputObjectType(gqlType)) {
      code = buildInputTypeCode(gqlType, scalarCodeMap, schema);
    } else {
      console.warn(
        `[graphql-zod] Unknown type "${info.typeName}" for field "${info.name}" — falling back to z.any()`,
      );
      code = 'z.any()';
    }
  } else {
    console.warn(
      `[graphql-zod] Unknown type "${info.typeName}" for field "${info.name}" — falling back to z.any()`,
    );
    code = 'z.any()';
  }

  if (info.nullable) code = `${code}.nullish()`;
  if (info.array) code = `${code}.array()`;

  return code;
}

function buildVariablesSchema(
  op: OperationDefinitionNode,
  scalarCodeMap: Record<string, string>,
  schema?: GraphQLSchema,
): string {
  const defs = op.variableDefinitions ?? [];
  if (defs.length === 0) return 'z.object({})';

  const fields = defs.map((varDef) => {
    const info: VariableInfo = {
      name: varDef.variable.name.value,
      nullable: true,
      array: false,
      typeName: '',
    };
    resolveTypeInfo(varDef.type, info);
    return `  ${info.name}: ${buildVariableCode(info, scalarCodeMap, schema)}`;
  });

  return `z.object({\n${fields.join(',\n')},\n})`;
}

function buildFieldCode(
  field: FieldNode,
  parentType: GraphQLObjectType,
  scalarCodeMap: Record<string, string>,
): string | null {
  const fieldName = field.name.value;
  const fieldDef = parentType.getFields()[fieldName];
  if (!fieldDef) return null;

  const rawType = fieldDef.type as GraphQLOutputType;
  const nullable = !isGqlNonNull(rawType);
  const unwrapped = isGqlNonNull(rawType) ? rawType.ofType : rawType;
  const isList = isGqlList(unwrapped);
  const namedType: GraphQLNamedType = getGqlNamedType(rawType);

  let code: string;

  if (isGqlObjectType(namedType) && field.selectionSet) {
    const inner = buildSelectionSetCode(field.selectionSet, namedType, scalarCodeMap);
    code = `z.object({\n${inner}\n})`;
  } else if (isGqlEnumType(namedType)) {
    // TODO: generate z.enum([...values]) instead of z.string()
    code = 'z.string()';
  } else if (isGqlUnionType(namedType)) {
    console.warn(
      `[graphql-zod] Union type "${namedType.name}" is not yet supported — falling back to z.any()`,
    );
    code = 'z.any()';
  } else if (namedType.name in scalarCodeMap) {
    code = scalarCodeMap[namedType.name];
  } else {
    console.warn(`[graphql-zod] Unknown type "${namedType.name}" — falling back to z.any()`);
    code = 'z.any()';
  }

  if (nullable) code = `${code}.nullish()`;
  if (isList) code = `${code}.array()`;

  return `  ${fieldName}: ${code}`;
}

function buildSelectionSetCode(
  selectionSet: SelectionSetNode,
  parentType: GraphQLObjectType,
  scalarCodeMap: Record<string, string>,
): string {
  const lines: string[] = [];

  for (const selection of selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue; // TODO: handle fragments
    const line = buildFieldCode(selection, parentType, scalarCodeMap);
    if (line) lines.push(line);
  }

  return lines.join(',\n');
}

function buildResultSchema(
  op: OperationDefinitionNode,
  schema: GraphQLSchema,
  scalarCodeMap: Record<string, string>,
): string {
  let rootType: GraphQLObjectType | null | undefined;

  if (op.operation === 'query') rootType = schema.getQueryType();
  else if (op.operation === 'mutation') rootType = schema.getMutationType();
  else if (op.operation === 'subscription') rootType = schema.getSubscriptionType();

  if (!rootType || !op.selectionSet) return 'z.object({})';

  const inner = buildSelectionSetCode(op.selectionSet, rootType, scalarCodeMap);
  return `z.object({\n${inner}\n})`;
}

export const plugin: PluginFunction<PluginConfig> = (schema: GraphQLSchema, documents, config) => {
  const scalarCodeMap: Record<string, string> = {
    ...defaultScalarCodeMap,
    ...config.scalars,
  };

  const blocks: string[] = [];

  for (const docFile of documents) {
    if (!docFile.document) continue;

    for (const def of docFile.document.definitions) {
      if (def.kind !== Kind.OPERATION_DEFINITION || !def.name) continue;

      const opName = def.name.value;
      const opType = capitalize(def.operation);
      const prefix = `${opName}${opType}`;

      const variablesSchema = buildVariablesSchema(def, scalarCodeMap, schema);
      blocks.push(`export const ${prefix}VariablesSchema = ${variablesSchema};`);

      const resultSchema = buildResultSchema(def, schema, scalarCodeMap);
      blocks.push(`export const ${prefix}ResultSchema = ${resultSchema};`);

      blocks.push('');
    }
  }

  return {
    prepend: [
      "import { z } from 'zod';",
      "import { numericString } from '@vantreeseba/graphql-zod';",
      '',
    ],
    content: blocks.join('\n'),
  };
};
