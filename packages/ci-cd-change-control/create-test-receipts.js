#!/usr/bin/env node

/**
 * Generate valid test receipts using the CI/CD Receipt Emitter
 * This creates a proper deployment lifecycle with cryptographically valid hashes
 */

import { CICDReceiptEmitter } from './dist/receipt-emitter.js';
import fs from 'node:fs';

async function createTestDeployment() {
  console.log('🚀 Creating test deployment receipts with valid cryptographic hashes...');

  // Initialize receipt emitter
  const emitter = new CICDReceiptEmitter({ receiptDir: './test-receipts' });

  try {
    // 1. Process a standard deployment request
    console.log('1. Processing deployment request with policy evaluation...');

    const deploymentRequest = await emitter.processDeploymentRequest({
      deployment_id: 'deploy_001',
      artifact_digest: 'sha256:abc123def456',
      env: 'prod',
      commit_sha: 'commit123abc',
      pipeline_run_id: 'run_001',
      service: 'payment-service',
      team: 'payments',
      requested_by: 'alice',
      risk_factors: {
        database_migration: false,
        infrastructure_change: false,
        off_hours_deployment: false,
        rollback_available: true,
        automated_tests_passing: true,
        production_data_involved: false,
        schema_change: false,
        breaking_api_changes: false,
        external_dependencies: false,
        first_deployment: false,
      },
      change_description: 'Update payment processing logic',
      rollback_plan: 'Revert to previous version via blue-green deployment',
    });

    console.log(`   Status: ${deploymentRequest.status}`);
    console.log(`   Risk score: ${deploymentRequest.policy_result.risk_score}`);
    console.log(`   Friction cost: ${deploymentRequest.policy_result.friction_cost}`);

    // 2. If approval required, process approval
    if (deploymentRequest.status === 'pending_approval') {
      console.log('2. Processing manual approval...');

      const approvalResult = await emitter.processApproval({
        deployment_id: 'deploy_001',
        artifact_digest: 'sha256:abc123def456',
        env: 'prod',
        commit_sha: 'commit123abc',
        pipeline_run_id: 'run_001',
        service: 'payment-service',
        team: 'payments',
        approver_id: 'bob',
        deployment_roles: {
          deploy_requester: 'alice',
          build_creator: 'charlie',
        },
      });

      console.log('   Approval processed');
    }

    // 3. Complete the deployment
    console.log('3. Completing deployment...');

    await emitter.emitDeployCompleted({
      deployment_id: 'deploy_001',
      artifact_digest: 'sha256:abc123def456',
      env: 'prod',
      commit_sha: 'commit123abc',
      pipeline_run_id: 'run_001',
      service: 'payment-service',
      team: 'payments',
      deployed_at: Date.now(),
    });

    // 4. Create a high-risk deployment scenario
    console.log('4. Creating high-risk deployment scenario...');

    const highRiskRequest = await emitter.processDeploymentRequest({
      deployment_id: 'deploy_002',
      artifact_digest: 'sha256:def456ghi789',
      env: 'prod',
      commit_sha: 'commit456def',
      pipeline_run_id: 'run_002',
      service: 'user-service',
      team: 'identity',
      requested_by: 'alice',
      risk_factors: {
        database_migration: true,
        infrastructure_change: true,
        off_hours_deployment: false,
        rollback_available: true,
        automated_tests_passing: true,
        production_data_involved: true,
        schema_change: true,
        breaking_api_changes: false,
        external_dependencies: false,
        first_deployment: false,
      },
      change_description: 'Major database schema migration',
      rollback_plan: 'Full database rollback script prepared',
    });

    console.log(`   High-risk status: ${highRiskRequest.status}`);
    console.log(`   Risk score: ${highRiskRequest.policy_result.risk_score}`);
    console.log(`   Required capabilities: ${highRiskRequest.policy_result.required_capabilities.join(', ')}`);

    // 5. Create emergency deployment scenario
    console.log('5. Creating emergency deployment scenario...');

    const emergencyResult = await emitter.processEmergencyDeploy({
      deployment_id: 'deploy_003',
      artifact_digest: 'sha256:emergency123',
      env: 'prod',
      commit_sha: 'hotfix789',
      pipeline_run_id: 'emergency_001',
      service: 'payment-service',
      team: 'payments',
      requester_id: 'bob',
      reason: 'Critical payment processing outage',
      incident_id: 'inc_001',
    });

    console.log(`   Emergency status: ${emergencyResult.status}`);
    console.log(`   Post-facto required: ${emergencyResult.post_facto_required.join(', ')}`);

    // 6. Complete the emergency retro review
    await emitter.emitRetroReviewCompleted({
      deployment_id: 'deploy_003',
      artifact_digest: 'sha256:emergency123',
      env: 'prod',
      commit_sha: 'hotfix789',
      pipeline_run_id: 'emergency_001',
      service: 'payment-service',
      team: 'payments',
      actor_id: 'bob',
      incident_id: 'inc_001',
    });

    console.log('6. Emergency retro review completed');

    emitter.close();

    // Copy the generated receipts to test-receipts.jsonl for verification
    const receiptsContent = fs.readFileSync('./test-receipts/receipts.jsonl', 'utf-8');
    fs.writeFileSync('./test-receipts.jsonl', receiptsContent);

    console.log('✅ Test receipts generated successfully!');
    console.log('📂 Valid receipt chain written to test-receipts.jsonl');

    return true;

  } catch (error) {
    console.error('❌ Error creating test receipts:', error);
    emitter.close();
    return false;
  }
}

// Run the test
await createTestDeployment();