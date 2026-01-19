import type { CoordinationReceipt } from "coordination-kernel";
import { loadAndVerifyChain } from "coordination-kernel";
import type { ReplayResult, DeploymentFacts, CICDAction, CICDReceiptInputs } from "./types.js";

function ensureDeployment(map: Record<string, DeploymentFacts>, id: string, seed: Partial<DeploymentFacts>) {
  if (!map[id]) {
    map[id] = {
      deployment_id: id,
      env: (seed.env ?? "dev") as any,
      commit_sha: seed.commit_sha ?? "",
      pipeline_run_id: seed.pipeline_run_id ?? "",
      artifact_digest: seed.artifact_digest ?? "",
      service: seed.service,
      team: seed.team,
      status: "requested",
      errors: []
    };
  }
  return map[id];
}

export async function replayFromJsonlFile(jsonlPath: string): Promise<{ receipts: CoordinationReceipt[]; replay: ReplayResult; }> {
  const verification = await loadAndVerifyChain(jsonlPath);

  if (verification.integrity !== 'valid') {
    const msg = `Receipt chain integrity is broken`;
    const err = new Error(msg);
    (err as any).verification = verification;
    throw err;
  }

  const receipts = verification.receipts;
  const deployments: Record<string, DeploymentFacts> = {};
  const counts: ReplayResult["counts"] = {
    requested: 0, approved: 0, denied: 0, deployed: 0, failed: 0, rolled_back: 0, emergency: 0, unknown: 0
  };

  for (const r of receipts) {
    const action = r.action as CICDAction;
    const inputs = r.inputs as unknown as CICDReceiptInputs;

    const depId = inputs?.deployment_id;
    if (!depId) continue;

    const d = ensureDeployment(deployments, depId, {
      env: inputs.env,
      commit_sha: inputs.commit_sha,
      pipeline_run_id: inputs.pipeline_run_id,
      artifact_digest: inputs.artifact_digest,
      service: inputs.service,
      team: inputs.team
    });

    // Keep the most useful join facts always up-to-date:
    d.env = inputs.env ?? d.env;
    d.service = inputs.service ?? d.service;
    d.team = inputs.team ?? d.team;
    d.commit_sha = inputs.commit_sha ?? d.commit_sha;
    d.pipeline_run_id = inputs.pipeline_run_id ?? d.pipeline_run_id;
    d.artifact_digest = inputs.artifact_digest ?? d.artifact_digest;

    const ts = typeof r.timestamp === "string" ? Date.parse(r.timestamp) : Date.now();

    if (action === "deploy_requested") {
      d.requester_id = r.actor_id;
      d.requested_at = ts;
      d.status = "requested";
    }

    if (action === "policy_eval") {
      d.has_policy_eval = true;
      d.risk_score = inputs.risk_score ?? d.risk_score;
      d.friction_cost = inputs.friction_cost ?? d.friction_cost;
    }

    if (action === "risk_assessment_completed") {
      d.has_risk_assessment = true;
    }

    if (action === "deploy_approved") {
      d.approver_id = r.actor_id;
      d.approved_at = ts;
      d.status = "approved";
    }

    if (action === "deploy_denied") {
      d.approver_id = r.actor_id;
      d.status = "denied";
    }

    if (action === "deploy_completed") {
      d.completed_at = ts;
      d.status = "deployed";
    }

    if (action === "deploy_failed") {
      d.completed_at = ts;
      d.status = "failed";
    }

    if (action === "rollback_completed") {
      d.status = "rolled_back";
    }

    if (action === "emergency_deploy") {
      d.emergency = true;
      d.status = "emergency";
      d.requester_id = d.requester_id ?? r.actor_id;
    }

    if (action === "incident_linked") {
      d.incident_linked_at = ts;
    }

    if (action === "retro_review_completed") {
      d.retro_review_completed_at = ts;
    }
  }

  // Count final states
  for (const id of Object.keys(deployments)) {
    const s = deployments[id].status ?? "unknown";
    counts[s] = (counts[s] ?? 0) + 1;
  }

  return { receipts, replay: { deployments, counts } };
}