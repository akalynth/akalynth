import { getRookguardQuestInput } from './world/rookguardQuest.js';

export type LibraryDiscoveryState = 'locked' | 'discovered' | 'highlighted';

export interface LibraryDiscoveryEntry {
  codex_id: string;
  state: LibraryDiscoveryState;
  reason?: string;
}

export interface LibraryDiscoveryResponse {
  ok: true;
  character_id: string;
  vocation: string | null;
  rookguard_complete: boolean;
  entries: LibraryDiscoveryEntry[];
}

const VOCATION_TO_CODEX: Record<string, string> = {
  warden: 'heroes-codex',
  cantor: 'heroes-codex',
  hexer: 'heroes-codex',
  reaver: 'heroes-codex',
};

/**
 * Receipt-backed Library discovery for the public site (no economy impact).
 * Derived from replayed rookguard quest + onward-route projections.
 */
export function buildLibraryDiscovery(characterId: string): LibraryDiscoveryResponse {
  const quest = getRookguardQuestInput(characterId);
  const rookguardComplete = quest.tutorial.complete;
  const vocation = quest.vocation;

  const entries: LibraryDiscoveryEntry[] = [];

  const push = (codexId: string, state: LibraryDiscoveryState, reason?: string) => {
    const existing = entries.find((e) => e.codex_id === codexId);
    if (existing) {
      if (state === 'highlighted' || (state === 'discovered' && existing.state === 'locked')) {
        existing.state = state;
        existing.reason = reason ?? existing.reason;
      }
      return;
    }
    entries.push({ codex_id: codexId, state, reason });
  };

  // Always visible on Library (illustrated plates) — still listed for sync parity.
  for (const id of [
    'high-city',
    'memory-serpent',
    'echo-stalker',
    'void-whale',
    'dreamweaver',
    'chronoshell-turtle',
  ]) {
    push(id, 'discovered', 'public_codex_plate');
  }

  if (quest.tutorial.tem) {
    push('witness-moth', 'discovered', 'tem_challenge_passed');
  }

  if (vocation) {
    push('heroes-codex', 'highlighted', `vocation_declared:${vocation}`);
    push(VOCATION_TO_CODEX[vocation] ?? 'heroes-codex', 'highlighted', `vocation:${vocation}`);
  }

  if (rookguardComplete) {
    push('rookguard', 'highlighted', 'tutorial_completed');
    push('high-city', 'discovered', 'gate_unlock');
    push('forgehold', 'discovered', 'onward_routes_unlocked');
    push('emberwilds-atlas', 'discovered', 'onward_routes_unlocked');
    push('emberwilds', 'discovered', 'onward_routes_unlocked');
    push('origins-codex', 'discovered', 'gameplay_lane_unlocked');
  }

  // Locked entries the player has not earned yet.
  for (const id of [
    'artifacts-codex',
    'chronicle-of-ages',
    'dungeon-codex',
    'factions-codex',
    'emberwilds-atlas',
    'origins-codex',
    'rookguard',
  ]) {
    if (!entries.some((e) => e.codex_id === id)) {
      push(id, 'locked', 'complete_rookguard_codex_path');
    }
  }

  return {
    ok: true,
    character_id: characterId,
    vocation,
    rookguard_complete: rookguardComplete,
    entries,
  };
}