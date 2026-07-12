/**
 * aiDecider.mjs
 * Thin wrapper: local AI (Ollama) proposes decisions with explicit leverage analysis.
 * Builds context from observation + receipt experience window + per-agent knowledge.
 * Returns structured proposal; caller must verify + fallback.
 * Pure I/O boundary only; no execution.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = process.env.LOCAL_LLM_MODEL || 'llama3.2:3b';

export async function callLocalLLM(prompt, { model = DEFAULT_MODEL, temperature = 0.7 } = {}) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature, num_predict: 400 }
    })
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  return (data.response || '').trim();
}

export function buildDecisionPrompt({ agent, observation, receiptWindow, knowledge = {} }) {
  const recent = (receiptWindow || []).map(r => {
    const s = r.summary || r.action || JSON.stringify(r).slice(0,120);
    return `- step${r.step ?? ''}: ${s}`;
  }).join('\n');

  const know = [
    ...Object.entries(knowledge.economy || {}).map(([k,v]) => `ECON: ${k}=${v}`),
    ...Object.entries(knowledge.world || {}).map(([k,v]) => `WORLD: ${k}=${v}`),
    ...Object.entries(knowledge.rules || {}).map(([k,v]) => `RULE: ${k}=${v}`)
  ].join('\n') || '(none yet)';

  return `You are an autonomous learning agent inside Akalynth sim.
Role: ${agent.role || 'explorer'}. ID: ${agent.id || 'agent-x'}.
Current observation: ${JSON.stringify(observation || {})}
Recent receipt experience (your learning data):
${recent || '(no recent receipts)'}

What you already learned this session:
${know}

TASK: Choose ONE next action that advances you. Explicitly identify LEVERAGE you have or can create.
Leverage examples: capital advantage, information (you saw a receipt others didn't), timing, position on map, contract lock-in, heat state of others, etc.

Allowed action types: noop, move, bid, interact, observe, work, buy_property, list_property, explore.

Respond with ONLY a single JSON object (no prose outside):
{
  "action": { "type": "string from allowed", "params": { } },
  "rationale": "1-2 sentences including what you learned",
  "leverage": "precise description of the leverage you are using (economy|world|rules)",
  "confidence": 0.0-1.0
}`;
}

export async function proposeWithLocalAI(context) {
  const prompt = buildDecisionPrompt(context);
  let raw;
  try {
    raw = await callLocalLLM(prompt);
  } catch (e) {
    // delegate to pure deterministic for seed/step variety (AC2) + full contract shape
    const ctx = context || {};
    const rw = ctx.receiptWindow || [];
    const ag = ctx.agent || {};
    const step = (rw[0] && rw[0].step) || 0;
    const seed = (ctx.seed || (ag.id || '').length || 0);
    let fb;
    try {
      const pure = await import('./pure-logic.mjs');
      fb = pure.deterministicFallbackPolicy(ctx, rw, { seed, step });
    } catch {
      fb = { type: 'observe', params: { reason: 'pure-fb-fallback' } };
    }
    const hasEcon = rw.some(r => /bid|auction|property/.test(String(r.summary || r.action || '')));
    const lev = hasEcon ? 'economy-receipts' : (ag.role || 'agent') + '-pos-step' + (step % 3);
    return {
      decisionId: 'dec-fallback-' + Date.now(),
      timestamp: new Date().toISOString(),
      inputReceiptRefs: rw.slice(0, 3).map(r => r.id || 'r'),
      proposedAction: { type: fb.type, params: fb.params || {} },
      rationale: 'deterministic varied via pure-logic (seed/step driven)',
      leverage: lev,
      confidence: 0.55,
      verifier: '1.0.0',
      source: 'fallback'
    };
  }

  // robust parse
  let jsonStr = raw;
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) jsonStr = m[0];
  let proposal;
  try {
    proposal = JSON.parse(jsonStr);
  } catch (e) {
    return { error: 'parse-failed', raw: raw.slice(0,300), fallbackOnly: true };
  }

  if (!proposal.action || !proposal.action.type) {
    return { error: 'missing-action', raw: proposal, fallbackOnly: true };
  }

  // Return full decision contract object so it can be passed directly to verifyDecision
  return {
    decisionId: 'dec-ai-' + Date.now(),
    timestamp: new Date().toISOString(),
    inputReceiptRefs: (context.receiptWindow || []).slice(0,3).map(r => r.id || 'r'),
    proposedAction: proposal.action,
    rationale: proposal.rationale || '',
    leverage: proposal.leverage || '',
    confidence: typeof proposal.confidence === 'number' ? proposal.confidence : 0.5,
    verifier: '1.0.0',
    source: 'local-ai',
    model: DEFAULT_MODEL
  };
}

export function buildContextFromSim(agent, observation, receiptWindow, knowledge) {
  return { agent, observation, receiptWindow, knowledge: knowledge || {} };
}
