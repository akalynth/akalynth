#!/usr/bin/env node

/**
 * Simple test using the compiled CI/CD Receipt Emitter
 * Tests the basic emitter methods that are already compiled
 */

import { CICDReceiptEmitter } from './dist/receipt-emitter.js';
import fs from 'node:fs';

async function createSimpleTestDeployment() {
  console.log('🚀 Creating simple test deployment receipts...');

  // Initialize receipt emitter
  const emitter = new CICDReceiptEmitter({ receiptDir: './test-receipts' });

  try {
    const baseInputs = {
      deployment_id: 'deploy_001',
      artifact_digest: 'sha256:abc123def456',
      env: 'prod',
      commit_sha: 'commit123abc',
      pipeline_run_id: 'run_001',
      service: 'payment-service',
      team: 'payments',
    };

    // 1. Deploy requested
    console.log('1. Emitting deploy_requested receipt...');
    await emitter.emitDeployRequested({
      ...baseInputs,
      requested_by: 'alice',
    });

    // 2. Policy evaluation (manual)
    console.log('2. Emitting policy_eval receipt...');
    await emitter.emitPolicyEval({
      ...baseInputs,
      risk_score: 3,
      friction_cost: 50,
      required_capabilities: ['approve_prod_deploy:service=payment-service'],
      approval_ttl: '120m',
      risk_factors: ['production_deployment'],
    });

    // 3. Deploy approved
    console.log('3. Emitting deploy_approved receipt...');
    await emitter.emitDeployApproved({
      ...baseInputs,
      approver_id: 'bob',
    });

    // 4. Deploy completed
    console.log('4. Emitting deploy_completed receipt...');
    await emitter.emitDeployCompleted({
      ...baseInputs,
      deployed_at: Date.now(),
    });

    // 5. Emergency deployment
    console.log('5. Emitting emergency_deploy receipt...');
    const emergencyInputs = {
      deployment_id: 'deploy_002',
      artifact_digest: 'sha256:emergency123',
      env: 'prod',
      commit_sha: 'hotfix789',
      pipeline_run_id: 'emergency_001',
      service: 'payment-service',
      team: 'payments',
    };

    await emitter.emitEmergencyDeploy({
      ...emergencyInputs,
      requester_id: 'bob',
      reason: 'Critical payment processing outage',
    });

    // 6. Link incident (within deadline)
    await emitter.emitIncidentLinked({
      ...emergencyInputs,
      actor_id: 'bob',
      incident_id: 'inc_001',
    });

    // 7. Complete retro review (within deadline)
    await emitter.emitRetroReviewCompleted({
      ...emergencyInputs,
      actor_id: 'bob',
      incident_id: 'inc_001',
    });

    // 8. Create a FAILING emergency deployment (missing post-facto requirements)
    console.log('6. Creating failing emergency deployment...');
    const failingEmergencyInputs = {
      deployment_id: 'deploy_003',
      artifact_digest: 'sha256:failing123',
      env: 'prod',
      commit_sha: 'failing789',
      pipeline_run_id: 'failing_001',
      service: 'auth-service',
      team: 'security',
    };

    await emitter.emitEmergencyDeploy({
      ...failingEmergencyInputs,
      requester_id: 'charlie',
      reason: 'Auth system down',
    });

    // Intentionally NOT linking incident or completing retro review
    // This will demonstrate compliance failure detection for emergency path

    emitter.close();

    // Copy the generated receipts to test-receipts.jsonl for verification
    const receiptsContent = fs.readFileSync('./test-receipts/receipts.jsonl', 'utf-8');
    fs.writeFileSync('./test-receipts.jsonl', receiptsContent);

    console.log('✅ Enhanced test receipts generated successfully!');
    console.log('📂 Valid receipt chain written to test-receipts.jsonl');

    return true;

  } catch (error) {
    console.error('❌ Error creating test receipts:', error);
    emitter.close();
    return false;
  }
}

// Run the test
await createSimpleTestDeployment();