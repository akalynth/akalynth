/**
 * Verifier Registry + Dependency Resolution
 *
 * Manages all registered verifiers and resolves execution order via topological sort.
 */

import { VerifierSpec } from './types.js';

export class VerifierRegistry {
  private specs = new Map<string, VerifierSpec>();

  /**
   * Register a verifier
   */
  register(spec: VerifierSpec): void {
    if (this.specs.has(spec.id)) {
      throw new Error(`Duplicate verifier id: ${spec.id}`);
    }
    this.specs.set(spec.id, spec);
  }

  /**
   * Get all registered verifiers
   */
  list(): VerifierSpec[] {
    return Array.from(this.specs.values());
  }

  /**
   * Get a specific verifier by ID
   */
  get(id: string): VerifierSpec {
    const spec = this.specs.get(id);
    if (!spec) {
      throw new Error(`Unknown verifier: ${id}`);
    }
    return spec;
  }

  /**
   * Check if a verifier exists
   */
  has(id: string): boolean {
    return this.specs.has(id);
  }

  /**
   * Resolve execution order via topological sort (Kahn's algorithm)
   *
   * @param selectedIds - Optional list of verifier IDs to run (includes transitive deps)
   * @returns Ordered list of verifiers to execute
   * @throws Error if dependency cycle detected
   */
  resolveOrder(selectedIds?: string[]): VerifierSpec[] {
    // If specific verifiers selected, use those; otherwise use all
    const selected = selectedIds?.length
      ? new Set(selectedIds)
      : new Set(this.specs.keys());

    // Include transitive dependencies automatically
    const includeDeps = (id: string): void => {
      const spec = this.get(id);
      (spec.dependsOn ?? []).forEach((dep) => {
        if (!selected.has(dep)) {
          selected.add(dep);
          includeDeps(dep);
        }
      });
    };

    Array.from(selected).forEach(includeDeps);

    // Build dependency graph
    const deps = new Map<string, Set<string>>();
    const reverse = new Map<string, Set<string>>();

    for (const id of selected) {
      const spec = this.get(id);
      const specDeps = new Set((spec.dependsOn ?? []).filter((x) => selected.has(x)));
      deps.set(id, specDeps);

      for (const dep of specDeps) {
        if (!reverse.has(dep)) {
          reverse.set(dep, new Set());
        }
        reverse.get(dep)!.add(id);
      }
    }

    // Kahn's algorithm: find all nodes with no incoming edges
    const queue: string[] = Array.from(selected).filter(
      (id) => (deps.get(id)?.size ?? 0) === 0
    );
    queue.sort(); // Deterministic order within same phase

    const ordered: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      ordered.push(node);

      // Remove this node from all dependents
      for (const dependent of reverse.get(node) ?? []) {
        deps.get(dependent)!.delete(node);
        if (deps.get(dependent)!.size === 0) {
          queue.push(dependent);
          queue.sort(); // Keep deterministic
        }
      }
    }

    // If we didn't process all nodes, there's a cycle
    if (ordered.length !== selected.size) {
      const remaining = Array.from(selected).filter((id) => !ordered.includes(id));
      throw new Error(
        `Dependency cycle detected in verifiers: ${remaining.join(', ')}`
      );
    }

    return ordered.map((id) => this.get(id));
  }

  /**
   * Get verifiers grouped by phase
   */
  byPhase(): Map<number, VerifierSpec[]> {
    const grouped = new Map<number, VerifierSpec[]>();

    for (const spec of this.specs.values()) {
      const phase = spec.phase;
      if (!grouped.has(phase)) {
        grouped.set(phase, []);
      }
      grouped.get(phase)!.push(spec);
    }

    return grouped;
  }
}
