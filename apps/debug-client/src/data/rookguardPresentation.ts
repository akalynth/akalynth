import type { PlayLoopProgress } from "@shared/types";

export function rookguardGateStatusLabel(loop: PlayLoopProgress | null): string | null {
  if (!loop?.rookguardQuest || loop.complete) return null;
  if (loop.gateOpen) return "Gate open — walk onto the golden arch at (10,2).";
  const missing = loop.rookguardQuest.steps
    .filter((step) => !step.complete && step.step_id !== "gate")
    .map((step) => step.label);
  if (missing.length === 0) return "Gate open — walk onto the golden arch at (10,2).";
  const suffix = missing.length === 1 ? "" : "s";
  return "Gate locked — " + missing.length + " step" + suffix + " left: " + missing.join(", ") + ".";
}

export function rookguardGateLockedToast(loop: PlayLoopProgress): string {
  return rookguardGateStatusLabel(loop) ?? "Gate locked — complete the Codex path first.";
}
