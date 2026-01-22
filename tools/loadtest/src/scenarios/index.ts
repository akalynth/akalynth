/**
 * Scenario Registry
 *
 * Central registry for all load test scenarios.
 */

import { ClientAction } from '../client.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ScenarioConfig {
  name: string;
  description: string;
  thinkTime: {
    min_ms: number;
    max_ms: number;
  };
}

export interface Scenario {
  config: ScenarioConfig;
  getNextAction(rng: () => number, clientState: { inWorld: boolean }): ClientAction;
}

// -----------------------------------------------------------------------------
// Scenario Implementations
// -----------------------------------------------------------------------------

export const movementHeavyScenario: Scenario = {
  config: {
    name: 'movement-heavy',
    description: 'Simulates exploration/grinding zones',
    thinkTime: { min_ms: 120, max_ms: 450 },
  },
  getNextAction(rng, state) {
    if (!state.inWorld) {
      return { type: 'enter_world' };
    }

    const roll = rng();
    if (roll < 0.7) {
      return { type: 'move_intent' };
    } else if (roll < 0.9) {
      return { type: 'idle' };
    } else {
      return { type: 'chat' };
    }
  },
};

export const chattyScenario: Scenario = {
  config: {
    name: 'chatty',
    description: 'Simulates town squares and social hubs',
    thinkTime: { min_ms: 250, max_ms: 1200 },
  },
  getNextAction(rng, state) {
    if (!state.inWorld) {
      return { type: 'enter_world' };
    }

    const roll = rng();
    if (roll < 0.5) {
      return { type: 'chat' };
    } else if (roll < 0.8) {
      return { type: 'move_intent' };
    } else {
      return { type: 'idle' };
    }
  },
};

export const edgePathScenario: Scenario = {
  config: {
    name: 'edge-path',
    description: 'Tests session lifecycle stability',
    thinkTime: { min_ms: 100, max_ms: 500 },
  },
  getNextAction(rng, state) {
    if (!state.inWorld) {
      return { type: 'enter_world' };
    }

    // Occasional logout for lifecycle testing
    const roll = rng();
    if (roll < 0.02) {
      return { type: 'logout' };
    } else if (roll < 0.7) {
      return { type: 'move_intent' };
    } else if (roll < 0.9) {
      return { type: 'chat' };
    } else {
      return { type: 'idle' };
    }
  },
};

export const temPathScenario: Scenario = {
  config: {
    name: 'tem-path',
    description: 'Controlled anti-cheat trigger verification',
    thinkTime: { min_ms: 100, max_ms: 200 },
  },
  getNextAction(rng, state) {
    if (!state.inWorld) {
      return { type: 'enter_world' };
    }

    // Heavy movement to potentially trigger TEM
    // The short think time + high movement rate may trigger anti-cheat
    const roll = rng();
    if (roll < 0.9) {
      return { type: 'move_intent' };
    } else {
      return { type: 'idle' };
    }
  },
};

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------

export const scenarios: Map<string, Scenario> = new Map([
  ['movement-heavy', movementHeavyScenario],
  ['chatty', chattyScenario],
  ['edge-path', edgePathScenario],
  ['tem-path', temPathScenario],
]);

export function getScenario(name: string): Scenario {
  const scenario = scenarios.get(name);
  if (!scenario) {
    const available = Array.from(scenarios.keys()).join(', ');
    throw new Error(`Unknown scenario: ${name}. Available: ${available}`);
  }
  return scenario;
}

export function listScenarios(): string[] {
  return Array.from(scenarios.keys());
}
