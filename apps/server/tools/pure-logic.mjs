// Pure logic for AKALYNTH_AGENT_LEARNING_CONTRACT_V1
//
// THE VERIFIER IS THE BOUNDARY.
//
// AI may propose actions (low-level moves or higher-order intents/strategies).
// This module is the ONLY place that decides whether a proposal is allowed
// to influence the simulated world.
//
//   AI proposal
//        ↓  (this file)
//   Contract validation + policy gates + confidence/leverage rules
//        ↓
//   Approved / Rejected
//
// Approved proposals may then cause normal world code to emit receipts.
// The receipts (not the AI output) become the new ground truth.
//
// Deterministic fallback always exists so the world does not depend on AI availability.
// This is essential for replay, tests, and offline development.

export const CONTRACT_VERSION = '1.0.0';

export function createEmptyDecision() {
  return {
    decisionId: '',
    timestamp: '',
    inputReceiptRefs: [],
    proposedAction: { type: 'noop', params: {} },
    rationale: '',
    leverage: '',
    confidence: 0,
    verifier: CONTRACT_VERSION
  };
}

export function validateDecisionContract(decision) {
  const errors = [];
  if (!decision || typeof decision !== 'object') {
    errors.push('decision must be an object');
    return { valid: false, errors };
  }
  if (!decision.decisionId || typeof decision.decisionId !== 'string' || decision.decisionId.length < 3) {
    errors.push('decisionId required (min length 3)');
  }
  if (!decision.timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(decision.timestamp)) {
    errors.push('timestamp must be ISO-like');
  }
  if (!Array.isArray(decision.inputReceiptRefs)) {
    errors.push('inputReceiptRefs must be array');
  } else if (decision.inputReceiptRefs.length === 0) {
    errors.push('inputReceiptRefs must reference at least one receipt');
  }
  const action = decision.proposedAction || {};
  if (!action.type || typeof action.type !== 'string') {
    errors.push('proposedAction.type required');
  }
  const allowed = [
    'noop', 'move', 'bid', 'interact', 'observe', 'work',
    'buy_property', 'list_property', 'explore', 'complete_work_contract',
    // Higher-order proposals (AI as advisor, still fully verified)
    'declare_strategy'
  ];
  if (action.type && !allowed.includes(action.type)) {
    errors.push('proposedAction.type not in allowed policy space');
  }
  if (decision.leverage !== undefined && typeof decision.leverage !== 'string') {
    errors.push('leverage must be string if present');
  }
  if (typeof decision.confidence !== 'number' || decision.confidence < 0 || decision.confidence > 1) {
    errors.push('confidence must be 0.0-1.0');
  }
  if (decision.verifier !== CONTRACT_VERSION) {
    errors.push('verifier contract version mismatch');
  }
  return { valid: errors.length === 0, errors };
}

export function deterministicFallbackPolicy(context, receipts, opts = {}) {
  // Pure deterministic fallback. Never relies on external model.
  // Extended for AC2: seed/step-driven variety so action sequences differ across runs.
  const { seed = 0, step = 0 } = opts || {};
  const recent = Array.isArray(receipts) ? receipts.slice(-5) : [];
  const hasEconomy = recent.some(r => r && (r.type === 'economy-event' || (r.summary || '').includes('bid') || (r.summary || '').includes('auction') || (r.action || '').includes('bid')));
  const s = (Number(seed) || 0) % 4;
  const t = Number(step) || 0;
  const idx = (s + t) % 3;

  // Occasionally (but reliably for training) propose a higher-order strategy.
  // This enables the full "AI proposal → verifier → behavior change → world outcome → receipt" loop
  // even when using pure deterministic fallback. The verifier still enforces the rules.
  if (hasEconomy && step > 0 && (t % 3 === 0)) {
    return {
      type: 'declare_strategy',
      params: {
        domain: 'trade',
        stance: 'aggressive',
        horizon_steps: 6,
        reason: 'recent-economy-signals'
      }
    };
  }

  if (hasEconomy) {
    const actions = ['observe', 'bid', 'work'];
    return { type: actions[idx], params: { reason: 'recent-economy', seed, step } };
  }
  const actions = ['noop', 'observe', 'explore'];
  return { type: actions[idx], params: { reason: 'safe-default', seed, step } };
}

export function makeReceiptExperienceWindow(snapshot, step) {
  // Slice receipts around a step for context (the learning dataset).
  if (!snapshot || !Array.isArray(snapshot.receipts)) return [];
  const target = typeof step === 'number' ? step : (snapshot.timeline ? snapshot.timeline.currentStep : 0);
  return snapshot.receipts.filter(r => Math.abs((r.step || 0) - target) <= 3);
}

export function verifyDecision(decision, context, receipts) {
  // The core gate: contract + schema + policy compatibility.
  const contractCheck = validateDecisionContract(decision);
  if (!contractCheck.valid) {
    return { approved: false, reason: 'contract-invalid', errors: contractCheck.errors };
  }

  const fallback = deterministicFallbackPolicy(context, receipts || []);
  const proposedType = (decision.proposedAction && decision.proposedAction.type) || 'noop';

  // Gate: if proposed differs from fallback, require high confidence or explicit leverage rationale.
  if (proposedType !== fallback.type && (decision.confidence || 0) < 0.7) {
    if (!decision.leverage || decision.leverage.length < 5) {
      return {
        approved: false,
        reason: 'low-confidence-vs-fallback-and-no-leverage',
        fallback,
        proposed: decision.proposedAction
      };
    }
  }

  // Special handling for higher-order strategy declarations.
  // These are AI-proposed world signals (e.g. "I will bias toward fish buying").
  // They must carry clear leverage and should not be low-confidence spam.
  if (proposedType === 'declare_strategy') {
    const params = decision.proposedAction.params || {};
    if (!params.domain || typeof params.domain !== 'string') {
      return { approved: false, reason: 'strategy-missing-domain', proposed: decision.proposedAction };
    }
    if ((decision.confidence || 0) < 0.65) {
      return { approved: false, reason: 'strategy-confidence-too-low', proposed: decision.proposedAction };
    }
    if (!decision.leverage || decision.leverage.length < 8) {
      return { approved: false, reason: 'strategy-requires-strong-leverage', proposed: decision.proposedAction };
    }
  }

  // Accept (would normally emit a receipt here in full system).
  return {
    approved: true,
    reason: 'passed-verifier',
    executedAction: decision.proposedAction,
    fallbackUsed: proposedType === fallback.type,
    leverage: decision.leverage || ''
  };
}

export function createSampleDecisionFromReceipts(receipts) {
  const refs = (receipts || []).slice(0, 3).map(r => r.id || 'unknown');
  return {
    decisionId: 'dec-' + Date.now(),
    timestamp: new Date().toISOString(),
    inputReceiptRefs: refs.length ? refs : ['sim-receipt-000'],
    proposedAction: { type: 'observe', params: { from: 'contract-sample' } },
    rationale: 'derived from recent receipts via deterministic path',
    leverage: 'info from recent receipts',
    confidence: 0.65,
    verifier: CONTRACT_VERSION
  };
}

// AC4: observable per-agent knowledge update from receipt + verify outcome.
export function updateAgentKnowledgeFromReceipt(knowledge, receipt, verifyResult) {
  const k = knowledge || { economy: {}, world: {}, rules: {} };
  k.economy = k.economy || {};
  k.world = k.world || {};
  k.rules = k.rules || {};
  const r = receipt || {};
  const summary = String(r.summary || r.action || '');
  if (/bid|auction|property|gold|economy/.test(summary)) {
    k.economy.receipts_seen = (k.economy.receipts_seen || 0) + 1;
    k.economy.last_receipt = summary.slice(0, 80);
  }
  if (r.step !== undefined) {
    k.world.steps_seen = (k.world.steps_seen || 0) + 1;
  }
  if (verifyResult && verifyResult.leverage) {
    k.economy.last_leverage = String(verifyResult.leverage).slice(0, 60);
  }
  if (verifyResult && verifyResult.approved) {
    k.rules.last_approved_action = (verifyResult.executedAction && verifyResult.executedAction.type) || 'unknown';
  }
  return k;
}
