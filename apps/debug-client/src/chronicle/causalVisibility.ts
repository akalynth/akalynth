import type { ChronicleEvent } from '@shared/protocol';
import { causalPlayerViewForDetails, type CausalPlayerView } from '@shared/causalParity';

export type CausalVisibilitySummary = CausalPlayerView;

/**
 * Turn completed, durable world-event rows into player-facing causal language.
 * Rejected intents never reach this read model, so they cannot be presented as
 * completed consequences.
 */
export function causalVisibilityForEvent(ev: ChronicleEvent): CausalVisibilitySummary | null {
  if (ev.kind !== 'world_event') return null;
  return ev.causal?.player_view ?? causalPlayerViewForDetails(ev.details);
}