---
name: anti-cheat-steward
description: Use when modifying Akalynth anti-cheat detection, heat, Tem challenges, enforcement, penalties, evidence, or player-facing anti-bot feedback.
version: 0.1.0
---

# Anti-Cheat Steward

Keep enforcement deterministic, evidenced, and explainable.

Separate these concerns:

- Detection: signals, cadence, movement anomalies, chat rate, priors.
- Penalty: heat changes, throttles, kicks, Tem challenges.
- Evidence: receipts and reconstructable facts.
- Player feedback: messages that explain what happened without exposing exploit details.

Rules:

- Do not punish from client-reported truth.
- Do not add hidden mutable enforcement state without receipts or replay coverage.
- Keep heat and Tem behavior deterministic.
- Prefer adding evidence and verification before adding harsher penalties.

Verification should include a focused anti-cheat test plus any receipt-chain impact.
