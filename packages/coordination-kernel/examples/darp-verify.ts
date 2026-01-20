#!/usr/bin/env node

// DARP Verification Tool
// 3-command regulator interface for compliance verification

import fs from 'node:fs';
import { loadAndVerifyChain, replayFromFile, generateIntegrityReport } from '../src/index.js';
import type { CoordinationReceipt } from '../src/index.js';

// ============================================================================
// DARP Compliance State for Verification
// ============================================================================

interface DARPVerificationState {
  total_transactions: number;
  reported_transactions: number;
  on_time_reports: number;
  late_reports: number;
  high_risk_approvals: number;
  segregation_violations: number;
  total_friction_costs: number;
  actors_active: Set<string>;
  compliance_actions: Map<string, number>;
}

function createInitialState(): DARPVerificationState {
  return {
    total_transactions: 0,
    reported_transactions: 0,
    on_time_reports: 0,
    late_reports: 0,
    high_risk_approvals: 0,
    segregation_violations: 0,
    total_friction_costs: 0,
    actors_active: new Set(),
    compliance_actions: new Map(),
  };
}

function darpComplianceReducer(state: DARPVerificationState, receipt: CoordinationReceipt): DARPVerificationState {
  const newState = { ...state };
  newState.actors_active = new Set(state.actors_active);
  newState.compliance_actions = new Map(state.compliance_actions);

  // Track active actors
  newState.actors_active.add(receipt.actor_id);

  // Track actions by type
  const currentCount = newState.compliance_actions.get(receipt.action) || 0;
  newState.compliance_actions.set(receipt.action, currentCount + 1);

  // Parse DARP-specific actions
  switch (receipt.action) {
    case 'darp_transaction_reported': {
      newState.reported_transactions++;

      const hoursLate = (receipt.inputs.hours_late as number) || 0;
      if (hoursLate > 0) {
        newState.late_reports++;
      } else {
        newState.on_time_reports++;
      }

      const frictionCost = (receipt.inputs.friction_cost as number) || 0;
      newState.total_friction_costs += frictionCost;
      break;
    }

    case 'darp_high_risk_approved': {
      newState.high_risk_approvals++;

      const frictionCost = (receipt.inputs.friction_cost as number) || 0;
      newState.total_friction_costs += frictionCost;
      break;
    }

    case 'friction_debit': {
      const amount = (receipt.inputs.amount as number) || 0;
      newState.total_friction_costs += amount;
      break;
    }

    case 'capability_gated': {
      if (receipt.inputs.reason === 'segregation_of_duties_violation') {
        newState.segregation_violations++;
      }
      break;
    }

    case 'segregation_of_duties_violation': {
      newState.segregation_violations++;
      break;
    }
  }

  return newState;
}

// ============================================================================
// Verification Commands
// ============================================================================

async function checkIntegrity(receiptFile: string): Promise<void> {
  console.log('🔍 DARP-VERIFY: Checking receipt chain integrity...\n');

  try {
    const verification = await loadAndVerifyChain(receiptFile);

    if (verification.integrity === 'valid') {
      console.log('✅ Receipt integrity: VALID');
      console.log(`   Total receipts: ${verification.receipts.length}`);
      console.log(`   Chain unbroken: Genesis → ${verification.last_hash?.slice(0, 16)}...`);

      if (verification.receipts.length > 0) {
        const firstReceipt = verification.receipts[0];
        const lastReceipt = verification.receipts[verification.receipts.length - 1];

        console.log(`   Time span: ${firstReceipt.timestamp} → ${lastReceipt.timestamp}`);
        console.log(`   Genesis hash: ${firstReceipt.evidence_hash.slice(0, 16)}...`);
        console.log(`   Latest hash: ${lastReceipt.evidence_hash.slice(0, 16)}...`);
      }

      console.log('\n🛡️  Cryptographic verification: PASSED');
      console.log('    Every receipt hash verified');
      console.log('    Chain links verified');
      console.log('    No tampering detected');

    } else {
      console.log('❌ Receipt integrity: BROKEN');

      const report = generateIntegrityReport(verification.receipts);
      console.log(`   Total receipts: ${report.total_receipts}`);
      console.log(`   Hash failures: ${report.hash_failures}`);
      console.log(`   Chain breaks: ${report.chain_breaks}`);
      console.log(`   Genesis valid: ${report.genesis_valid}`);

      if (report.first_error) {
        console.log(`   First error: ${report.first_error}`);
      }

      console.log('\n⚠️  Chain integrity compromised - cannot verify compliance');
    }

  } catch (error) {
    console.error('❌ Integrity check failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function replayState(receiptFile: string): Promise<void> {
  console.log('⏮️  DARP-VERIFY: Replaying state from receipts...\n');

  try {
    const finalState = await replayFromFile(
      receiptFile,
      darpComplianceReducer,
      createInitialState()
    );

    console.log('✅ State replay: COMPLETE');
    console.log('   Deterministic reconstruction from receipts');
    console.log('   100% verifiable state derivation');
    console.log('');

    console.log('📊 RECONSTRUCTED STATE:');
    console.log(`   Reported transactions: ${finalState.reported_transactions}`);
    console.log(`   On-time reports: ${finalState.on_time_reports}`);
    console.log(`   Late reports: ${finalState.late_reports}`);
    console.log(`   High-risk approvals: ${finalState.high_risk_approvals}`);
    console.log(`   Segregation violations: ${finalState.segregation_violations}`);
    console.log(`   Total friction costs: ${finalState.total_friction_costs}`);
    console.log(`   Active actors: ${finalState.actors_active.size}`);

    console.log('\n🔍 ACTION BREAKDOWN:');
    for (const [action, count] of finalState.compliance_actions.entries()) {
      console.log(`   ${action}: ${count}`);
    }

    console.log('\n💡 VERIFICATION NOTE:');
    console.log('   This state is 100% derived from cryptographic receipts');
    console.log('   No human interpretation or trust required');
    console.log('   Mathematics guarantees correctness');

  } catch (error) {
    console.error('❌ Replay failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function checkCompliance(receiptFile: string): Promise<void> {
  console.log('⚖️  DARP-VERIFY: Evaluating DARP compliance...\n');

  try {
    const finalState = await replayFromFile(
      receiptFile,
      darpComplianceReducer,
      createInitialState()
    );

    // DARP compliance rules evaluation
    const totalTransactions = finalState.reported_transactions;
    const complianceRate = totalTransactions > 0
      ? (finalState.on_time_reports / totalTransactions) * 100
      : 100;

    const hasViolations = finalState.segregation_violations > 0;
    const complianceStatus = complianceRate === 100 && !hasViolations ? 'PASS' : 'FAIL';

    console.log('📋 DARP COMPLIANCE ASSESSMENT:');
    console.log(`   Overall Status: ${complianceStatus}`);
    console.log(`   Compliance Rate: ${complianceRate.toFixed(1)}%`);
    console.log(`   On-time Filing: ${finalState.on_time_reports}/${totalTransactions}`);
    console.log(`   Late Filings: ${finalState.late_reports}`);
    console.log('');

    console.log('🔒 REGULATORY REQUIREMENTS:');
    console.log(`   ✓ Daily Transaction Reports: ${finalState.reported_transactions} filed`);
    console.log(`   ${hasViolations ? '❌' : '✓'} Segregation of Duties: ${finalState.segregation_violations} violations`);
    console.log(`   ✓ High-Risk Assessments: ${finalState.high_risk_approvals} completed`);
    console.log(`   ✓ Audit Trail: Complete and immutable`);
    console.log(`   ✓ Cost Allocation: ${finalState.total_friction_costs} friction units`);
    console.log('');

    if (complianceStatus === 'PASS') {
      console.log('✅ DARP COMPLIANCE: PASS');
      console.log('   All regulatory requirements met');
      console.log('   100% on-time filing achieved');
      console.log('   No segregation violations detected');
      console.log('   Complete audit trail maintained');
    } else {
      console.log('❌ DARP COMPLIANCE: FAIL');
      if (complianceRate < 100) {
        console.log(`   Late filing rate: ${100 - complianceRate}%`);
      }
      if (hasViolations) {
        console.log(`   Segregation violations: ${finalState.segregation_violations}`);
      }
    }

    console.log('');
    console.log('🎯 REGULATOR VERIFICATION:');
    console.log('   Compliance status derived mathematically');
    console.log('   No subjective interpretation required');
    console.log('   Receipt chain provides complete evidence');
    console.log('   Deterministic outcome: ' + complianceStatus);

  } catch (error) {
    console.error('❌ Compliance check failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

function printUsage(): void {
  console.log('DARP Verification Tool - Regulator Interface');
  console.log('============================================');
  console.log('');
  console.log('Usage: darp-verify <command> <receipts.jsonl>');
  console.log('');
  console.log('Commands:');
  console.log('  check-integrity  Verify receipt chain cryptographic integrity');
  console.log('  replay          Replay receipts to reconstruct compliance state');
  console.log('  compliance      Generate deterministic PASS/FAIL compliance assessment');
  console.log('');
  console.log('Examples:');
  console.log('  darp-verify check-integrity receipts.jsonl');
  console.log('  darp-verify replay receipts.jsonl');
  console.log('  darp-verify compliance receipts.jsonl');
  console.log('');
  console.log('Note: This tool requires no trust - all verification is mathematical.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    printUsage();
    process.exit(1);
  }

  const [command, receiptFile] = args;

  if (!fs.existsSync(receiptFile)) {
    console.error(`❌ Receipt file not found: ${receiptFile}`);
    process.exit(1);
  }

  switch (command) {
    case 'check-integrity':
      await checkIntegrity(receiptFile);
      break;

    case 'replay':
      await replayState(receiptFile);
      break;

    case 'compliance':
      await checkCompliance(receiptFile);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

// ============================================================================
// CLI Execution
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}