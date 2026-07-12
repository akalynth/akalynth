// Capability System Index
// Export all capability-related functionality
export * from './gates.js';
export * from './constraints.js';
export * from './registry.js';
import { checkActorCapability } from './registry.js';
/**
 * Enforce segregation of duties constraint
 * Example: Actor who files risk_assessment cannot approve_high_risk
 */
export async function enforceSegregationOfDuties(actor, attempted_action, audit, segregationRules = {
    'approve_high_risk': ['risk_assessment_filer'],
    'final_approval': ['initial_reviewer', 'risk_assessor'],
    'audit_sign_off': ['report_preparer']
}) {
    const conflicts = segregationRules[attempted_action] || [];
    for (const conflictingCap of conflicts) {
        if (actor.capabilities.includes(conflictingCap)) {
            await audit.write({
                actor_id: actor.id,
                action: 'segregation_of_duties_violation',
                inputs: {
                    attempted_action,
                    conflicting_capability: conflictingCap,
                    reason: 'same_actor_cannot_perform_both_roles'
                },
                result: 'blocked',
            });
            return {
                allowed: false,
                reason: `Segregation of duties: cannot ${attempted_action} when having ${conflictingCap}`
            };
        }
    }
    return { allowed: true };
}
/**
 * DARP Compliance Example: Check transaction reporting capability with segregation
 */
export async function checkDARPTransactionReporting(actor_id, amount, audit) {
    const required_cap = amount > 10000 ? 'report_high_value_transactions' : 'report_transactions';
    // Check basic capability
    const capCheck = await checkActorCapability(actor_id, required_cap, 'transaction_report', audit);
    if (!capCheck.allowed || !capCheck.actor) {
        return { allowed: false, reason: capCheck.reason };
    }
    // Check segregation of duties
    const segregationCheck = await enforceSegregationOfDuties(capCheck.actor, 'transaction_report', audit, {
        'transaction_report': ['transaction_approver', 'risk_approver']
    });
    return segregationCheck;
}
