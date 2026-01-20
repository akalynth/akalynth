import type { CoordinationReceipt } from "coordination-kernel";
import { loadAndVerifyChain } from "coordination-kernel";
import type { ReplayResult, DeploymentFacts, CICDAction, CICDReceiptInputs } from "./types.js";

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

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

    const ts = parseTimestamp(r.timestamp);
    if (ts === null) {
      d.errors.push(`invalid_timestamp:${action}`);
    }

    if (action === "deploy_requested") {
      d.requester_id = r.actor_id;
      if (ts !== null) {
        d.requested_at = ts;
      }
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
      if (ts !== null) {
        d.approved_at = ts;
      }
      d.status = "approved";
    }

    if (action === "deploy_denied") {
      d.approver_id = r.actor_id;
      d.status = "denied";
    }

    if (action === "deploy_completed") {
      if (ts !== null) {
        d.completed_at = ts;
      }
      d.status = "deployed";
    }

    if (action === "deploy_failed") {
      if (ts !== null) {
        d.completed_at = ts;
      }
      d.status = "failed";
    }

    if (action === "rollback_completed") {
      d.status = "rolled_back";
    }

    if (action === "emergency_deploy") {
      const firstEmergency = d.emergency !== true;
      d.emergency = true;
      d.status = "emergency";
      if (firstEmergency) {
        const requesterInput = (r.inputs as Record<string, unknown> | undefined)?.requester_id;
        if (typeof requesterInput === "string" && requesterInput.length > 0) {
          d.requester_id = requesterInput;
        } else {
          d.errors.push("emergency break-glass: missing requester_id");
        }
        if (ts !== null && d.requested_at === undefined) {
          d.requested_at = ts;
        }
      }
    }

    if (action === "incident_linked") {
      if (ts !== null) {
        d.incident_linked_at = ts;
      }
    }

    if (action === "retro_review_completed") {
      const reviewerInput = (r.inputs as Record<string, unknown> | undefined)?.reviewer_id;
      const reviewerId = typeof reviewerInput === "string" && reviewerInput.trim().length > 0
        ? reviewerInput
        : r.actor_id;
      if (ts !== null && (d.retro_review_first_at === undefined || ts < d.retro_review_first_at)) {
        d.retro_review_first_at = ts;
        d.retro_review_reviewer_id = reviewerId;
      }
      if (d.requester_id && reviewerId && reviewerId !== d.requester_id) {
        d.retro_review_any_independent = true;
      }
    }
  }

  // Count final states
  for (const id of Object.keys(deployments)) {
    const s = deployments[id].status ?? "unknown";
    counts[s] = (counts[s] ?? 0) + 1;
  }

  return { receipts, replay: { deployments, counts } };
}
