// Receipt System Index
// Export all receipt-related functionality

export * from './hasher.js';
export * from './logger.js';
export * from './verify.js';

// Example reducer for testing/demonstration
export interface ExampleState {
  actors: Map<string, { action_count: number; last_action: string | null }>;
  total_actions: number;
  chain_length: number;
}

/**
 * Example reducer showing how receipt replay reconstructs state
 */
export function exampleReducer(state: ExampleState, receipt: import('../types.js').CoordinationReceipt): ExampleState {
  const actorId = receipt.actor_id;
  const currentActor = state.actors.get(actorId) || { action_count: 0, last_action: null };

  const newActors = new Map(state.actors);
  newActors.set(actorId, {
    action_count: currentActor.action_count + 1,
    last_action: receipt.action,
  });

  return {
    actors: newActors,
    total_actions: state.total_actions + 1,
    chain_length: state.chain_length + 1,
  };
}

/**
 * Create initial state for example reducer
 */
export function createExampleInitialState(): ExampleState {
  return {
    actors: new Map(),
    total_actions: 0,
    chain_length: 0,
  };
}