/**
 * Protocol Surface Extractor
 *
 * Uses ts-morph to extract the protocol surface from protocol.ts:
 * - PROTOCOL_VERSION constant
 * - ClientMessage/ServerMessage union members
 * - Message interfaces (extends BaseMessage)
 * - Type aliases (ErrorCode, etc.)
 * - Shared types (referenced by messages)
 * - Guard functions (parseClientMessage, isValidDirection)
 */

import { Project, InterfaceDeclaration, TypeAliasDeclaration, VariableDeclaration, SyntaxKind } from 'ts-morph';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

export interface FieldShape {
  type: string;
  optional: boolean;
  readonly: boolean;
}

export interface MessageShape {
  extends: 'BaseMessage';
  fields: Record<string, FieldShape>;
}

export interface TypeAliasShape {
  kind: 'union' | 'literal';
  members: string[];
}

export interface InterfaceShape {
  fields: Record<string, FieldShape>;
}

export interface ProtocolSurface {
  version: string;
  messages: {
    client: Record<string, MessageShape>;
    server: Record<string, MessageShape>;
  };
  typeAliases: Record<string, TypeAliasShape>;
  sharedTypes: Record<string, InterfaceShape>;
  guards: string[];
}

export interface GoldenSnapshot {
  version: string;
  generatedAt: string;
  source: {
    path: string;
    hash: string;
  };
  surface: ProtocolSurface;
}

/**
 * Extract protocol surface from protocol.ts
 */
export function extractProtocolSurface(protocolPath: string, tsconfigPath: string): ProtocolSurface {
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  });

  const sourceFile = project.addSourceFileAtPath(protocolPath);

  // 1. Extract PROTOCOL_VERSION
  const versionDecl = sourceFile.getVariableDeclaration('PROTOCOL_VERSION');
  if (!versionDecl) {
    throw new Error('PROTOCOL_VERSION constant not found in protocol.ts');
  }
  const versionInit = versionDecl.getInitializer();
  if (!versionInit || !versionInit.isKind(SyntaxKind.StringLiteral)) {
    throw new Error('PROTOCOL_VERSION must be a string literal');
  }
  const version = versionInit.getLiteralText();

  // 2. Extract ClientMessage and ServerMessage union member names
  const clientMessageAlias = sourceFile.getTypeAlias('ClientMessage');
  const serverMessageAlias = sourceFile.getTypeAlias('ServerMessage');

  if (!clientMessageAlias || !serverMessageAlias) {
    throw new Error('ClientMessage or ServerMessage union not found');
  }

  const clientMessageNames = extractUnionMemberNames(clientMessageAlias);
  const serverMessageNames = extractUnionMemberNames(serverMessageAlias);

  // 3. Extract message interfaces
  const clientMessages: Record<string, MessageShape> = {};
  const serverMessages: Record<string, MessageShape> = {};

  for (const name of clientMessageNames) {
    const iface = sourceFile.getInterface(name);
    if (iface) {
      clientMessages[name] = extractMessageShape(iface);
    }
  }

  for (const name of serverMessageNames) {
    const iface = sourceFile.getInterface(name);
    if (iface) {
      serverMessages[name] = extractMessageShape(iface);
    }
  }

  // 4. Extract type aliases (enums/unions)
  const typeAliases: Record<string, TypeAliasShape> = {};
  const exportedTypeAliases = sourceFile.getTypeAliases().filter(t => t.isExported());

  for (const alias of exportedTypeAliases) {
    const name = alias.getName();
    // Skip ClientMessage and ServerMessage (already handled)
    if (name === 'ClientMessage' || name === 'ServerMessage') continue;

    const shape = extractTypeAliasShape(alias);
    if (shape) {
      typeAliases[name] = shape;
    }
  }

  // 5. Extract shared types (reference-based)
  const sharedTypes: Record<string, InterfaceShape> = {};
  const referencedTypeNames = collectReferencedTypes(clientMessages, serverMessages, typeAliases);

  for (const typeName of referencedTypeNames) {
    const iface = sourceFile.getInterface(typeName);
    if (iface && iface.isExported()) {
      // Skip message interfaces
      if (clientMessageNames.includes(typeName) || serverMessageNames.includes(typeName)) continue;
      sharedTypes[typeName] = extractInterfaceShape(iface);
    }
  }

  // 6. Extract guard functions
  const guards: string[] = [];
  const guardNames = ['parseClientMessage', 'isValidDirection'];
  for (const name of guardNames) {
    const func = sourceFile.getFunction(name);
    if (func && func.isExported()) {
      guards.push(name);
    }
  }

  return {
    version,
    messages: {
      client: sortObject(clientMessages),
      server: sortObject(serverMessages),
    },
    typeAliases: sortObject(typeAliases),
    sharedTypes: sortObject(sharedTypes),
    guards: guards.sort(),
  };
}

/**
 * Generate golden snapshot
 */
export function generateGoldenSnapshot(protocolPath: string, tsconfigPath: string): GoldenSnapshot {
  const surface = extractProtocolSurface(protocolPath, tsconfigPath);

  // Compute file hash
  const content = fs.readFileSync(protocolPath, 'utf-8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  return {
    version: surface.version,
    generatedAt: new Date().toISOString(),
    source: {
      path: protocolPath,
      hash: `sha256:${hash}`,
    },
    surface,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractUnionMemberNames(alias: TypeAliasDeclaration): string[] {
  const typeNode = alias.getTypeNode();
  if (!typeNode) return [];

  const type = typeNode.getType();
  if (!type.isUnion()) return [];

  const members: string[] = [];
  for (const unionMember of type.getUnionTypes()) {
    const symbol = unionMember.getSymbol();
    if (symbol) {
      members.push(symbol.getName());
    }
  }

  return members;
}

function extractMessageShape(iface: InterfaceDeclaration): MessageShape {
  return {
    extends: 'BaseMessage',
    fields: sortObject(extractFields(iface)),
  };
}

function extractInterfaceShape(iface: InterfaceDeclaration): InterfaceShape {
  return {
    fields: sortObject(extractFields(iface)),
  };
}

function extractFields(iface: InterfaceDeclaration): Record<string, FieldShape> {
  const fields: Record<string, FieldShape> = {};

  for (const prop of iface.getProperties()) {
    const name = prop.getName();
    const typeNode = prop.getTypeNode();
    const hasQuestionToken = prop.hasQuestionToken();
    const isReadonly = prop.isReadonly();

    let typeText = typeNode ? normalizeType(typeNode.getText()) : 'unknown';

    // Check if type includes undefined at top level
    const includesUndefined = typeText.includes(' | undefined');

    fields[name] = {
      type: typeText,
      optional: hasQuestionToken || includesUndefined,
      readonly: isReadonly,
    };
  }

  return fields;
}

function extractTypeAliasShape(alias: TypeAliasDeclaration): TypeAliasShape | null {
  const typeNode = alias.getTypeNode();
  if (!typeNode) return null;

  const type = typeNode.getType();

  if (type.isUnion()) {
    const members = type.getUnionTypes().map(t => {
      if (t.isStringLiteral()) {
        return `'${t.getLiteralValue()}'`;
      }
      return t.getText();
    });

    return {
      kind: 'union',
      members: members.sort(),
    };
  }

  if (type.isStringLiteral()) {
    return {
      kind: 'literal',
      members: [`'${type.getLiteralValue()}'`],
    };
  }

  return null;
}

function normalizeType(typeText: string): string {
  // Normalize whitespace around unions
  let normalized = typeText.replace(/\s*\|\s*/g, ' | ');

  // Sort union members alphabetically
  if (normalized.includes(' | ')) {
    const parts = normalized.split(' | ').map(s => s.trim());
    normalized = parts.sort().join(' | ');
  }

  return normalized;
}

function collectReferencedTypes(
  clientMessages: Record<string, MessageShape>,
  serverMessages: Record<string, MessageShape>,
  typeAliases: Record<string, TypeAliasShape>
): Set<string> {
  const referenced = new Set<string>();

  // Collect from message fields
  for (const msg of Object.values(clientMessages)) {
    for (const field of Object.values(msg.fields)) {
      extractTypeNames(field.type, referenced);
    }
  }

  for (const msg of Object.values(serverMessages)) {
    for (const field of Object.values(msg.fields)) {
      extractTypeNames(field.type, referenced);
    }
  }

  // Collect from type alias members
  for (const alias of Object.values(typeAliases)) {
    for (const member of alias.members) {
      extractTypeNames(member, referenced);
    }
  }

  return referenced;
}

function extractTypeNames(typeText: string, into: Set<string>): void {
  // Simple heuristic: match PascalCase identifiers
  const matches = typeText.match(/\b[A-Z][a-zA-Z0-9]*\b/g);
  if (matches) {
    for (const match of matches) {
      // Skip built-in types
      if (['Record', 'Array', 'Map', 'Set', 'Promise', 'String', 'Number', 'Boolean'].includes(match)) {
        continue;
      }
      into.add(match);
    }
  }
}

function sortObject<T>(obj: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}
