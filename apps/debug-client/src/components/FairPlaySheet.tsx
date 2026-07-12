import { useEffect, useMemo, useState } from 'react';

// Shape verified live against GET /v1/receipts/public (2026-06-23):
// top-level { receipts: [...] }, each receipt:
interface PublicReceipt {
  sequence?: number;
  timestamp?: string;
  prev_hash?: string;
  event_hash?: string;
  signature?: string;
  action?: string;
  inputs?: { map?: string; text?: string; [k: string]: unknown };
  result?: string;
  actor_id?: string;
}

interface TransparencyDoc {
  principles?: string[];
  fairness?: { principles?: string[] };
  [k: string]: unknown;
}

interface FairPlaySheetProps {
  open: boolean;
  httpBase: string;
  onClose: () => void;
}

// Actions where the SERVER refused to let money/shortcuts buy power.
const REFUSAL_ACTIONS = new Set(['legend_refused', 'first_attempt_stone_cannot_obtain']);

const DEFAULT_PRINCIPLES = [
  'Money cannot buy gameplay power',
  'Every state change is receipted',
  'Receipts are cryptographically signed and chain-linked',
  'Enforcement is deterministic and replayable',
];

interface Story {
  cls: string;
  tag: string;
  refusal: boolean;
  story: string;
  detail: string;
}

function tell(r: PublicReceipt): Story {
  const map = r.inputs?.map ?? 'the world';
  switch (r.action) {
    case 'legend_refused':
      return {
        cls: 'refused', tag: 'REFUSED', refusal: true,
        story: "The server refused to grant a legend that wasn't earned.",
        detail: `A shortcut to status was attempted in ${map}. Denied — and recorded.`,
      };
    case 'first_attempt_stone_cannot_obtain':
      return {
        cls: 'refused', tag: 'REFUSED', refusal: true,
        story: 'A player tried to skip the work for the stone. The server said no.',
        detail: `First-attempt acquisition blocked in ${map}. You cannot buy or rush this.`,
      };
    case 'death_in_azura':
      return {
        cls: 'death', tag: 'DEATH', refusal: false,
        story: 'A soul entered Azura, and died.',
        detail: `Recorded forever in ${map}. No respawn rewrites this receipt.`,
      };
    case 'rumor_seeded':
      return {
        cls: 'rumor', tag: 'LORE', refusal: false,
        story: r.inputs?.text ? `“${r.inputs.text}”` : 'A rumor took root in the world.',
        detail: `Lore seeded in ${map}.`,
      };
    default:
      return {
        cls: 'other', tag: (r.action ?? 'event').toUpperCase(), refusal: false,
        story: `${r.action ?? 'event'} in ${map}.`, detail: '',
      };
  }
}

function fmtTime(t?: string): string {
  if (!t) return '';
  try {
    return new Date(t).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return t;
  }
}

// Honest in-browser chain verification.
// The public ledger is a REDACTED SUBSET (private receipts withheld), so sequence
// numbers have gaps. We can only honestly verify a link when two public receipts are
// TRULY adjacent in the full chain (cur.sequence === prev.sequence + 1). Everything
// else is a withheld gap, NOT a break.
function verifyChain(receipts: PublicReceipt[]): {
  state: 'linked' | 'broken' | 'sampled';
  verified: number;
  breaks: number;
  gaps: number;
} {
  const bySeq = [...receipts]
    .filter((r) => typeof r.sequence === 'number')
    .sort((a, b) => (a.sequence! - b.sequence!));
  let verified = 0, breaks = 0, gaps = 0;
  for (let i = 1; i < bySeq.length; i++) {
    const prev = bySeq[i - 1], cur = bySeq[i];
    if (cur.sequence === prev.sequence! + 1) {
      if (prev.event_hash && cur.prev_hash) {
        verified++;
        if (cur.prev_hash !== prev.event_hash) breaks++;
      }
    } else {
      gaps++;
    }
  }
  const state = verified === 0 ? 'sampled' : breaks > 0 ? 'broken' : 'linked';
  return { state, verified, breaks, gaps };
}

export function FairPlaySheet({ open, httpBase, onClose }: FairPlaySheetProps) {
  const [receipts, setReceipts] = useState<PublicReceipt[]>([]);
  const [transparency, setTransparency] = useState<TransparencyDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${httpBase}/v1/receipts/public`);
        if (!res.ok) throw new Error(`receipts ${res.status}`);
        const data = (await res.json()) as { receipts?: PublicReceipt[] } | PublicReceipt[];
        const list = Array.isArray(data) ? data : data.receipts ?? [];
        // transparency is best-effort; don't fail the whole view if it's down
        let trans: TransparencyDoc | null = null;
        try {
          const tr = await fetch(`${httpBase}/v1/transparency`);
          if (tr.ok) trans = (await tr.json()) as TransparencyDoc;
        } catch { /* ignore */ }
        if (!cancelled) {
          setReceipts(list);
          setTransparency(trans);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, httpBase]);

  const principles = useMemo(
    () => transparency?.principles ?? transparency?.fairness?.principles ?? DEFAULT_PRINCIPLES,
    [transparency],
  );
  const refusals = useMemo(
    () => receipts.filter((r) => r.action && REFUSAL_ACTIONS.has(r.action)).length,
    [receipts],
  );
  const chain = useMemo(() => verifyChain(receipts), [receipts]);
  const display = useMemo(
    () => [...receipts].sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0)),
    [receipts],
  );

  if (!open) return null;

  const chainText =
    chain.state === 'linked'
      ? `✓ LINKED · ${chain.verified} adjacent link${chain.verified > 1 ? 's' : ''} verified, 0 breaks`
      : chain.state === 'broken'
        ? `✗ ${chain.breaks} BREAK(S) in ${chain.verified} checked`
        : 'SAMPLED · public view is a redacted slice';
  const gapText = chain.gaps ? ` · ${chain.gaps} private gap${chain.gaps > 1 ? 's' : ''} (receipts withheld)` : '';

  return (
    <div className="mobile-sheet-layer mobile-sheet-layer--fair-play">
      <button type="button" className="mobile-sheet-backdrop" onClick={onClose} aria-label="Close fair play" />
      <div className="fair-play-sheet" role="dialog" aria-modal="true" aria-label="Fair Play ledger">
        <div className="fair-play-sheet__header">
          <div>
            <span>Akalynth · Public Ledger</span>
            <strong>Fair Play</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close fair play">x</button>
        </div>

        <div className="fair-play-sheet__body">
          {error && <div className="fair-play-sheet__error" role="status">Ledger unreachable: {error}</div>}
          {loading && <div className="fair-play-sheet__muted">Reading the live ledger…</div>}

          {!loading && !error && (
            <>
              <div className="fair-play-sheet__hero">
                <div className="fair-play-sheet__bignum">{refusals}</div>
                <div className="fair-play-sheet__claim">times this server refused to sell gameplay power.</div>
                <div className="fair-play-sheet__sub">
                  {refusals > 0
                    ? 'Each refusal is a signed, permanent receipt. Money cannot buy your way past them.'
                    : 'No refusals on this lane yet — but the rule is live and every attempt will be receipted.'}
                </div>
                <div className={`fair-play-sheet__chain fair-play-sheet__chain--${chain.state}`}>
                  chain integrity: {chainText}{gapText}
                </div>
              </div>

              <div className="fair-play-sheet__section">
                <span className="fair-play-sheet__label">What this server promises</span>
                {principles.map((p, i) => (
                  <div key={i} className="fair-play-sheet__principle"><b>{i + 1}.</b> {p}</div>
                ))}
              </div>

              <div className="fair-play-sheet__section">
                <span className="fair-play-sheet__label">The ledger — every receipt, in plain words ({display.length})</span>
                {display.length === 0 ? (
                  <div className="fair-play-sheet__muted">No receipts yet. The ledger writes itself as the world is played.</div>
                ) : (
                  display.map((r) => {
                    const s = tell(r);
                    return (
                      <div key={r.event_hash ?? r.sequence} className={`fair-play-sheet__row fair-play-sheet__row--${s.cls}`}>
                        <div className="fair-play-sheet__row-top">
                          <span className="fair-play-sheet__story">{s.story}</span>
                          <span className="fair-play-sheet__meta">#{r.sequence ?? '?'} · {fmtTime(r.timestamp)}</span>
                        </div>
                        <div className="fair-play-sheet__detail">
                          <span className={`fair-play-sheet__badge fair-play-sheet__badge--${s.cls}`}>{s.tag}</span>
                          {' '}{s.detail}
                          <span className="fair-play-sheet__dim"> · actor {r.actor_id ?? 'anon'} · {r.result ?? 'ok'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="fair-play-sheet__note">
          Reads {httpBase.replace(/^https?:\/\//, '')} · chain verification runs in your browser.
        </div>
      </div>
    </div>
  );
}
