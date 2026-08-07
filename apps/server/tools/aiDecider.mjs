/**
 * aiDecider.mjs — AI Advisor for Akalynth training simulations.
 *
 * CORE BOUNDARY (this is the important contract):
 *
 *   AI proposes (with rationale + leverage + confidence)
 *        ↓
 *   Pure logic verifies (contract + policy + confidence gates)
 *        ↓
 *   World / simulation decides (execute only approved proposals)
 *        ↓
 *   Receipt records the outcome (immutable, replayable, observable)
 *
 * AI is NEVER the source of truth.
 * AI is a reasoning advisor that lives behind the simulation boundary.
 * The world state, economy, and player-visible changes are owned exclusively
 * by the receipt chain and the deterministic world rules.
 *
 * This file only produces *proposals*. It performs no world mutation.
 *
 * Provider priority (unless AKALYNTH_AI_PROVIDER forces):
 *   1. XAI_API_KEY present → https://api.x.ai/v1  (model: grok-4.5 or XAI_MODEL)
 *   2. LOCAL_LLM / Ollama available
 *   3. Pure deterministic fallback (pure-logic.mjs)
 *
 * Follows build-with-ai guidance: default to SpaceXAI.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL || 'llama3.2:3b';
const XAI_BASE = 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.5';

function getAiProvider() {
  const forced = (process.env.AKALYNTH_AI_PROVIDER || '').toLowerCase();
  if (forced === 'xai' || forced === 'spacexai') return 'xai';
  if (forced === 'local' || forced === 'ollama') return 'local';
  if (process.env.XAI_API_KEY) return 'xai';
  return 'local';
}

export async function callLocalLLM(prompt, { model = LOCAL_MODEL, temperature = 0.7 } = {}) {
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

export async function callXaiLLM(prompt, { model = XAI_MODEL, temperature = 0.7 } = {}) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY is required for xAI provider');

  const res = await fetch(`${XAI_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: 'You are a precise autonomous agent decision engine for Akalynth. Output ONLY valid minified JSON matching the requested schema. No markdown, no explanations outside the JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      store: false
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`xAI error ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  let text = '';
  if (typeof data.output_text === 'string') {
    text = data.output_text;
  } else if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item?.content && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c?.text === 'string') text += c.text;
        }
      }
    }
  } else if (data.choices && data.choices[0]?.message?.content) {
    text = data.choices[0].message.content;
  }
  return (text || '').trim();
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

PRINCIPLE: You are an advisor only. You propose. Verifier + world rules decide.
The simulation records everything as receipts. Your output will be verified before any effect.

TASK: Choose ONE next action (or higher-order strategy declaration) that advances you.
Explicitly identify LEVERAGE.

Allowed low-level action types: noop, move, bid, interact, observe, work, buy_property, list_property, explore.

Higher-order (use sparingly, only with strong evidence):
- declare_strategy : params must include { "domain": string (e.g. "fish" or "property"), "stance": "aggressive_buy" | "conservative" | "observe", "horizon_steps"?: number }

When you have clear evidence from recent receipts (supply shock, price movement, repeated successful bids, etc.)
you MAY output a declare_strategy instead of a micro-action. This becomes a recorded signal that
future steps (and potentially other agents) can observe.

Respond with ONLY a single JSON object (no prose outside):
{
  "action": { "type": "string from allowed", "params": { ... } },
  "rationale": "1-2 sentences including what you learned and the leverage",
  "leverage": "precise description of the leverage (economy|world|rules)",
  "confidence": 0.0-1.0
}`;
}

/**
 * Core proposal entry point.
 * Chooses provider automatically (or via AKALYNTH_AI_PROVIDER).
 * Kept as proposeWithLocalAI for backward compatibility with callers.
 */
export async function proposeWithLocalAI(context) {
  return proposeDecision(context);
}

/** Preferred general name going forward. */
export async function proposeDecision(context) {
  const prompt = buildDecisionPrompt(context);
  const provider = getAiProvider();
  const modelUsed = provider === 'xai' ? XAI_MODEL : LOCAL_MODEL;

  let raw;
  let sourceLabel = provider === 'xai' ? 'xai' : 'local-ai';

  try {
    if (provider === 'xai') {
      raw = await callXaiLLM(prompt);
    } else {
      raw = await callLocalLLM(prompt);
    }
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
    const isStrategy = fb.type === 'declare_strategy';
    const refs = rw.length > 0 ? rw.slice(0, 3).map(r => r.id || 'r') : ['sim-receipt-seed-0'];
    return {
      decisionId: 'dec-fallback-' + Date.now(),
      timestamp: new Date().toISOString(),
      inputReceiptRefs: refs,
      proposedAction: { type: fb.type, params: fb.params || {} },
      rationale: `deterministic varied via pure-logic (seed/step driven; ${provider}-provider-failed)`,
      leverage: lev || (isStrategy ? 'deterministic-economy-pattern' : ''),
      confidence: isStrategy ? 0.72 : 0.55,
      verifier: '1.0.0',
      source: 'fallback',
      model: modelUsed
    };
  }

  // robust parse (same for both providers)
  let jsonStr = raw;
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) jsonStr = m[0];
  let proposal;
  try {
    proposal = JSON.parse(jsonStr);
  } catch (e) {
    return { error: 'parse-failed', raw: raw.slice(0,300), fallbackOnly: true, provider };
  }

  if (!proposal.action || !proposal.action.type) {
    return { error: 'missing-action', raw: proposal, fallbackOnly: true, provider };
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
    source: sourceLabel,
    model: modelUsed,
    provider
  };
}

export function buildContextFromSim(agent, observation, receiptWindow, knowledge) {
  return { agent, observation, receiptWindow, knowledge: knowledge || {} };
}
