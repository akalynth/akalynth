import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MapData } from "../../../packages/shared/types.js";
import { toJsonlLine } from "../src/persist/index.js";
import { runAgentEconomySimulation } from "../src/simulation/agentEconomySimulation.js";

/**
 * Agent Economy Simulation runner.
 *
 * Usage:
 *   npm run simulate:agent-economy -- --ai --days=2 --seed=42
 *   AKALYNTH_AI_MODE=1 npm run simulate:agent-economy
 *
 * AI (LLM) decisions:
 *   - Default (recommended): export XAI_API_KEY=...  → uses SpaceXAI grok-4.5 (https://api.x.ai/v1)
 *   - Local: ensure Ollama running (default llama3.2:3b or LOCAL_LLM_MODEL)
 *   - Force: AKALYNTH_AI_PROVIDER=xai|local
 *
 * AI is strictly an advisor:
 *   proposal → pure-logic verifier → (if approved) world effect → receipt
 * The simulation now supports higher-order proposals such as "declare_strategy"
 * when the model sees strong leverage in the receipt window.
 */

function argValue(name: string, fallback: string): string {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function loadMap(name: string): MapData {
  return JSON.parse(readFileSync(resolve(process.cwd(), "../../packages/shared/maps", name), "utf8")) as MapData;
}

const seed = Number.parseInt(argValue("--seed", "42"), 10);
const days = Number.parseInt(argValue("--days", "3"), 10);
const format = argValue("--format", "json");
const useAI = process.argv.includes("--ai") || argValue("--ai", "false") === "true" || process.env.AKALYNTH_AI_MODE === "1";
// AI provider: when XAI_API_KEY is set, uses SpaceXAI (grok-4.5 via https://api.x.ai/v1) by default.
// Force with: AKALYNTH_AI_PROVIDER=xai|local
// Requires: export XAI_API_KEY=...   (see https://docs.x.ai)

(async () => {
  console.log(`[agent-sim] seed=${seed} days=${days} aiMode=${useAI} provider=${process.env.AKALYNTH_AI_PROVIDER || (process.env.XAI_API_KEY ? 'xai:auto' : 'local:auto')}`);
  const result = await runAgentEconomySimulation({
  seed: Number.isFinite(seed) ? seed : 42,
  days: Number.isFinite(days) ? days : 3,
  maps: {
    Rookguard: loadMap("rookguard.json"),
    Azura: loadMap("azura.json"),
  },
  aiMode: useAI,
});

if (format === "jsonl") {
  for (const step of result.steps) {
    console.log(JSON.stringify(step));
  }
} else if (format === "receipts-jsonl") {
  for (const receipt of result.receipts) {
    process.stdout.write(toJsonlLine(receipt));
  }
} else if (format === "training-jsonl") {
  for (const step of result.steps) {
    console.log(JSON.stringify({ record_type: "agent_step", ...step }));
  }
  for (const dialogue of result.npc_dialogues) {
    console.log(JSON.stringify({ record_type: "npc_dialogue", ...dialogue }));
  }
  console.log(JSON.stringify({ record_type: "simulation_summary", ...result.summary }));
} else if (format === "summary") {
  console.log(JSON.stringify(result.summary, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
  }
})();
