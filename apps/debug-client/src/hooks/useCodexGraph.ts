import { useMemo } from 'react';
import codexPublicGraph from '../data/codexPublicGraph.json';

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

const NODES = codexPublicGraph as CodexPublicNode[];

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
