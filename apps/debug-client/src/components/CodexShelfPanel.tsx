import { HudChromePanel } from './HudChromePanel';
import { useCodexGraph, type CodexPublicNode } from '../hooks/useCodexGraph';

interface CodexShelfPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (node: CodexPublicNode) => void;
}

export function CodexShelfPanel({ open, onClose, onSelect }: CodexShelfPanelProps) {
  const { shelfNodes, byId } = useCodexGraph();
  if (!open) return null;

  return (
    <div className="codex-shelf-overlay" role="dialog" aria-modal="true" aria-label="Codex shelf">
      <HudChromePanel className="codex-shelf-sheet" variant="panel" padding={16}>
        <div className="codex-shelf-header">
          <div>
            <span className="codex-shelf-kicker">Akalynth Codex</span>
            <strong>Play · Build · Govern</strong>
          </div>
          <button type="button" className="codex-shelf-close" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="codex-shelf-copy">
          Shelves load from <code>repos/akalynth-codex</code> public graph. Builder drafts stay preview-only until
          operator promotion.
        </p>
        <div className="codex-shelf-grid">
          {shelfNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className="codex-shelf-card"
              onClick={() => onSelect?.(node)}
            >
              <span className="codex-shelf-card__category">{node.category ?? node.type}</span>
              <strong>{node.title}</strong>
              <p>{node.summary ?? node.body?.slice(0, 120)}</p>
              {node.proof?.status_label && (
                <small>{node.proof.status_label}</small>
              )}
            </button>
          ))}
        </div>
        {shelfNodes.length === 0 && (
          <div className="codex-shelf-empty">No published codex shelves in graph.</div>
        )}
        <div className="codex-shelf-related" aria-label="Cross references">
          {shelfNodes.slice(0, 4).flatMap((node) => (node.related ?? []).slice(0, 2)).filter((id, i, arr) => arr.indexOf(id) === i).map((id) => {
            const related = byId.get(id);
            if (!related) return null;
            return (
              <span key={id} className="codex-shelf-pill">
                {related.title}
              </span>
            );
          })}
        </div>
      </HudChromePanel>
    </div>
  );
}