// Receipt System Index
// Export all receipt-related functionality
export * from './hasher.js';
export * from './key.js';
export * from './logger.js';
export * from './verify.js';
/**
 * Example reducer showing how receipt replay reconstructs state
 */
export function exampleReducer(state, receipt) {
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
export function createExampleInitialState() {
    return {
        actors: new Map(),
        total_actions: 0,
        chain_length: 0,
    };
}
