import { Kind, type TypeNode } from 'graphql';

export type VariableInfo = {
  name: string;
  nullable: boolean;
  array: boolean;
  typeName: string;
};

export function resolveTypeInfo(node: TypeNode, info: VariableInfo): VariableInfo {
  switch (node.kind) {
    case Kind.NON_NULL_TYPE:
      info.nullable = false;
      return resolveTypeInfo(node.type, info);
    case Kind.LIST_TYPE:
      info.array = true;
      return resolveTypeInfo(node.type, info);
    case Kind.NAMED_TYPE:
      info.typeName = node.name.value;
      return info;
  }
}
