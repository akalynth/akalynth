/**
 * Protocol Surface Differ
 *
 * Compares golden vs current protocol surface and classifies changes as:
 * - Breaking (requires major version bump + acknowledgement)
 * - Non-breaking (requires minor version bump)
 * - Readonly-only (requires golden update, no version bump)
 */

import type { ProtocolSurface, MessageShape, TypeAliasShape, InterfaceShape, FieldShape } from './extractor.js';

export type ChangeKind =
  | 'added_message'
  | 'removed_message'
  | 'added_field'
  | 'removed_field'
  | 'field_type_changed'
  | 'field_optionality_changed'
  | 'field_readonly_changed'
  | 'added_type_alias'
  | 'removed_type_alias'
  | 'type_alias_changed'
  | 'union_member_added'
  | 'union_member_removed'
  | 'added_shared_type'
  | 'removed_shared_type'
  | 'shared_type_changed'
  | 'guard_added'
  | 'guard_removed';

export interface Change {
  kind: ChangeKind;
  path: string; // e.g., "client.LoginMessage.field.token", "typeAliases.ErrorCode"
  oldValue?: string;
  newValue?: string;
  breaking: boolean;
}

export interface DriftReport {
  changes: Change[];
  hasBreaking: boolean;
  hasNonBreaking: boolean;
  hasReadonlyOnly: boolean;
}

/**
 * Compare golden vs current surface and classify changes
 */
export function diffProtocolSurface(golden: ProtocolSurface, current: ProtocolSurface): DriftReport {
  const changes: Change[] = [];

  // Compare messages
  diffMessages('client', golden.messages.client, current.messages.client, changes);
  diffMessages('server', golden.messages.server, current.messages.server, changes);

  // Compare type aliases
  diffTypeAliases(golden.typeAliases, current.typeAliases, changes);

  // Compare shared types
  diffSharedTypes(golden.sharedTypes, current.sharedTypes, changes);

  // Compare guards
  diffGuards(golden.guards, current.guards, changes);

  // Classify drift
  const breakingChanges = changes.filter(c => c.breaking);
  const readonlyOnlyChanges = changes.filter(c => c.kind === 'field_readonly_changed');
  const nonBreakingChanges = changes.filter(c => !c.breaking && c.kind !== 'field_readonly_changed');

  return {
    changes,
    hasBreaking: breakingChanges.length > 0,
    hasNonBreaking: nonBreakingChanges.length > 0,
    hasReadonlyOnly: readonlyOnlyChanges.length > 0 && breakingChanges.length === 0 && nonBreakingChanges.length === 0,
  };
}

/**
 * Generate change key for acknowledgement coverage
 */
export function getChangeKey(change: Change): string {
  const parts = change.path.split('.');
  switch (change.kind) {
    case 'removed_message':
      return `removed_message:${parts[0]}:${parts[1]}`;
    case 'removed_field':
      return `removed_field:${parts[1]}:${parts[3]}`;
    case 'field_type_changed':
      return `field_type_changed:${parts[1]}:${parts[3]}`;
    case 'field_optionality_changed':
      if (change.oldValue === 'false' && change.newValue === 'true') {
        return `optionality_tightened:${parts[1]}:${parts[3]}`;
      }
      return `optionality_changed:${parts[1]}:${parts[3]}`;
    case 'union_member_removed':
      return `union_member_removed:${parts[1]}:${change.oldValue}`;
    case 'removed_type_alias':
      return `removed_type_alias:${parts[1]}`;
    case 'removed_shared_type':
      return `removed_shared_type:${parts[1]}`;
    case 'guard_removed':
      return `guard_removed:${change.oldValue}`;
    default:
      return `${change.kind}:${change.path}`;
  }
}

// ============================================================================
// Diff Functions
// ============================================================================

function diffMessages(
  side: 'client' | 'server',
  golden: Record<string, MessageShape>,
  current: Record<string, MessageShape>,
  changes: Change[]
): void {
  const goldenKeys = new Set(Object.keys(golden));
  const currentKeys = new Set(Object.keys(current));

  // Removed messages (breaking)
  for (const key of goldenKeys) {
    if (!currentKeys.has(key)) {
      changes.push({
        kind: 'removed_message',
        path: `${side}.${key}`,
        oldValue: key,
        breaking: true,
      });
    }
  }

  // Added messages (non-breaking)
  for (const key of currentKeys) {
    if (!goldenKeys.has(key)) {
      changes.push({
        kind: 'added_message',
        path: `${side}.${key}`,
        newValue: key,
        breaking: false,
      });
    }
  }

  // Compare fields for existing messages
  for (const key of currentKeys) {
    if (goldenKeys.has(key)) {
      diffFields(`${side}.${key}`, golden[key].fields, current[key].fields, changes);
    }
  }
}

function diffFields(
  basePath: string,
  golden: Record<string, FieldShape>,
  current: Record<string, FieldShape>,
  changes: Change[]
): void {
  const goldenKeys = new Set(Object.keys(golden));
  const currentKeys = new Set(Object.keys(current));

  // Removed fields (breaking)
  for (const key of goldenKeys) {
    if (!currentKeys.has(key)) {
      changes.push({
        kind: 'removed_field',
        path: `${basePath}.field.${key}`,
        oldValue: golden[key].type,
        breaking: true,
      });
    }
  }

  // Added fields (breaking if required, non-breaking if optional)
  for (const key of currentKeys) {
    if (!goldenKeys.has(key)) {
      const field = current[key];
      changes.push({
        kind: 'added_field',
        path: `${basePath}.field.${key}`,
        newValue: field.type,
        breaking: !field.optional, // Required field addition is breaking
      });
    }
  }

  // Compare existing fields
  for (const key of currentKeys) {
    if (goldenKeys.has(key)) {
      const g = golden[key];
      const c = current[key];

      // Type change
      if (g.type !== c.type) {
        changes.push({
          kind: 'field_type_changed',
          path: `${basePath}.field.${key}`,
          oldValue: g.type,
          newValue: c.type,
          breaking: true, // Default to breaking (widening whitelist can be added later)
        });
      }

      // Optionality change
      if (g.optional !== c.optional) {
        changes.push({
          kind: 'field_optionality_changed',
          path: `${basePath}.field.${key}`,
          oldValue: String(g.optional),
          newValue: String(c.optional),
          breaking: g.optional && !c.optional, // optional → required is breaking
        });
      }

      // Readonly change (non-breaking, special case)
      if (g.readonly !== c.readonly) {
        changes.push({
          kind: 'field_readonly_changed',
          path: `${basePath}.field.${key}`,
          oldValue: String(g.readonly),
          newValue: String(c.readonly),
          breaking: false,
        });
      }
    }
  }
}

function diffTypeAliases(
  golden: Record<string, TypeAliasShape>,
  current: Record<string, TypeAliasShape>,
  changes: Change[]
): void {
  const goldenKeys = new Set(Object.keys(golden));
  const currentKeys = new Set(Object.keys(current));

  // Removed type aliases (breaking)
  for (const key of goldenKeys) {
    if (!currentKeys.has(key)) {
      changes.push({
        kind: 'removed_type_alias',
        path: `typeAliases.${key}`,
        oldValue: key,
        breaking: true,
      });
    }
  }

  // Added type aliases (non-breaking)
  for (const key of currentKeys) {
    if (!goldenKeys.has(key)) {
      changes.push({
        kind: 'added_type_alias',
        path: `typeAliases.${key}`,
        newValue: key,
        breaking: false,
      });
    }
  }

  // Compare existing aliases
  for (const key of currentKeys) {
    if (goldenKeys.has(key)) {
      const g = golden[key];
      const c = current[key];

      // Kind change (breaking)
      if (g.kind !== c.kind) {
        changes.push({
          kind: 'type_alias_changed',
          path: `typeAliases.${key}`,
          oldValue: g.kind,
          newValue: c.kind,
          breaking: true,
        });
        continue;
      }

      // Union member changes
      const gMembers = new Set(g.members);
      const cMembers = new Set(c.members);

      // Removed members (breaking)
      for (const member of gMembers) {
        if (!cMembers.has(member)) {
          changes.push({
            kind: 'union_member_removed',
            path: `typeAliases.${key}`,
            oldValue: member,
            breaking: true,
          });
        }
      }

      // Added members (non-breaking)
      for (const member of cMembers) {
        if (!gMembers.has(member)) {
          changes.push({
            kind: 'union_member_added',
            path: `typeAliases.${key}`,
            newValue: member,
            breaking: false,
          });
        }
      }
    }
  }
}

function diffSharedTypes(
  golden: Record<string, InterfaceShape>,
  current: Record<string, InterfaceShape>,
  changes: Change[]
): void {
  const goldenKeys = new Set(Object.keys(golden));
  const currentKeys = new Set(Object.keys(current));

  // Removed shared types (breaking)
  for (const key of goldenKeys) {
    if (!currentKeys.has(key)) {
      changes.push({
        kind: 'removed_shared_type',
        path: `sharedTypes.${key}`,
        oldValue: key,
        breaking: true,
      });
    }
  }

  // Added shared types (non-breaking)
  for (const key of currentKeys) {
    if (!goldenKeys.has(key)) {
      changes.push({
        kind: 'added_shared_type',
        path: `sharedTypes.${key}`,
        newValue: key,
        breaking: false,
      });
    }
  }

  // Compare fields for existing shared types
  for (const key of currentKeys) {
    if (goldenKeys.has(key)) {
      diffFields(`sharedTypes.${key}`, golden[key].fields, current[key].fields, changes);
    }
  }
}

function diffGuards(golden: string[], current: string[], changes: Change[]): void {
  const goldenSet = new Set(golden);
  const currentSet = new Set(current);

  // Removed guards (breaking)
  for (const guard of goldenSet) {
    if (!currentSet.has(guard)) {
      changes.push({
        kind: 'guard_removed',
        path: 'guards',
        oldValue: guard,
        breaking: true,
      });
    }
  }

  // Added guards (non-breaking)
  for (const guard of currentSet) {
    if (!goldenSet.has(guard)) {
      changes.push({
        kind: 'guard_added',
        path: 'guards',
        newValue: guard,
        breaking: false,
      });
    }
  }
}
