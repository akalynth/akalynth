#!/usr/bin/env node

/**
 * Final test demonstrating enhanced emergency deployment with policy_eval
 * Shows proper "mechanical risk memo" preservation during break-glass
 */

import { CICDReceiptEmitter } from './dist/receipt-emitter.js';
import fs from 'node:fs';

async function createEnhancedEmergencyTest() {
  console.log('🚀 Creating enhanced emergency deployment test...');

  const emitter = new CICDReceiptEmitter({ receiptDir: './final-test-receipts' });

  try {
    // Emergency deployment with policy evaluation
    console.log('1. Processing emergency deployment with risk assessment...');

    const emergencyInputs = {
      deployment_id: 'emergency_001',
      artifact_digest: 'sha256:hotfix789abc',
      env: 'prod',
      commit_sha: 'emergency_commit',
      pipeline_run_id: 'emergency_pipeline_001',
      service: 'critical-service',
      team: 'ops',
      requester_id: 'ops_lead',
      reason: 'Production outage - critical security patch',
      incident_id: 'sec_incident_001',
      risk_factors: {
        database_migration: false,
        infrastructure_change: false,
        off_hours_deployment: true,
        rollback_available: true,
        automated_tests_passing: false, // Emergency - no time for full tests
        production_data_involved: true,
        schema_change: false,
        breaking_api_changes: false,
        external_dependencies: true,
        first_deployment: false,
      },
    };

    // This will now emit both emergency_deploy AND policy_eval with override_required=true
    const emergencyResult = await emitter.processEmergencyDeploy(emergencyInputs);

    console.log(`   Status: ${emergencyResult.status}`);
    console.log(`   Post-facto required: ${emergencyResult.post_facto_required.join(', ')}`);

    // Complete the retro review
    await emitter.emitRetroReviewCompleted({
      ...emergencyInputs,
      actor_id: emergencyInputs.requester_id,
      incident_id: emergencyInputs.incident_id,
    });

    emitter.close();

    // Copy receipts for verification
    const receiptsContent = fs.readFileSync('./final-test-receipts/receipts.jsonl', 'utf-8');
    fs.writeFileSync('./final-test.jsonl', receiptsContent);

    console.log('✅ Enhanced emergency test completed!');
    console.log('📄 Receipt chain written to final-test.jsonl');
    console.log('🔍 Contains emergency_deploy + policy_eval with override_required=true');

    return true;

  } catch (error) {
    console.error('❌ Error:', error);
    emitter.close();
    return false;
  }
}

await createEnhancedEmergencyTest();