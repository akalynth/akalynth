import { useMemo } from 'react';

// Codex graph is an optional generated artifact from the sibling akalynth-codex repo.
// If absent, the hook degrades gracefully to empty (no codex shelf).
// See BUILD_HEALTH_REPAIR_PLAN_V1 for details on codex-public.graph.json.

export interface CodexPublicNode {
  id: string;
  type: string;
  published?: boolean;
  title: string;
  category?: string;
  summary?: string;
  body?: string;
  related?: string[];
  source_ref?: string;
  proof?: {
    object_id?: string;
    status?: string;
    status_label?: string;
  };
}

let NODES: CodexPublicNode[] = [];

try {
  // Use variable to avoid static analysis / pre-resolution by bundler for optional artifact
  const spec = '@' + 'codex/out/codex-public.graph.json';
  // @ts-ignore - may not exist at build time in this checkout
  const mod = await import(spec);
  NODES = (mod.default || mod) as CodexPublicNode[];
} catch {
  // graceful degradation - codex features disabled when artifact absent
  NODES = [];
}

export function useCodexGraph(): {
  nodes: CodexPublicNode[];
  byId: Map<string, CodexPublicNode>;
  shelfNodes: CodexPublicNode[];
} {
  return useMemo(() => {
    const published = NODES.filter((node) => node.published !== false);
    const byId = new Map(published.map((node) => [node.id, node]));
    const shelfNodes = published.filter((node) => {
      const category = (node.category ?? '').toLowerCase();
      const type = (node.type ?? '').toLowerCase();
      return (
        node.id === 'play-build-govern-surface'
        || category.includes('codex')
        || category.includes('system')
        || type === 'system'
        || node.id === 'rookguard'
        || node.id === 'high-city'
      );
    });
    return { nodes: published, byId, shelfNodes };
  }, []);
}