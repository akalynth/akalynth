export type SuspicionBand = 'low' | 'medium' | 'high';

export interface ExtractedReceipt {
  sequence: number;
  timestamp: string;
  timestamp_ms: number;
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
}

export interface LearningFeatureRow {
  feature_version: string;
  player_id: string;
  session_id: string;
  window_start: string;
  window_end: string;
  move_intent_count: number;
  accepted_move_count: number;
  rejected_move_count: number;
  reject_ratio: number;
  avg_move_interval_ms: number;
  move_interval_variance_ms: number;
  perfect_cadence_count: number;
  tem_challenge_issued_count: number;
  tem_response_count: number;
  tem_failed_count: number;
  heat_changed_count: number;
  max_heat_seen: number;
  heat_escalation_count: number;
  runestone_denial_spam_count: number;
  repeated_legend_probe_count: number;
  chat_message_count: number;
  chat_rate_spike_count: number;
  throttle_count: number;
  kick_count: number;
  rate_limit_exceeded_count: number;
  session_duration_ms: number;
  map_transition_count: number;
  disconnect_count: number;
  first_sequence: number;
  last_sequence: number;
  receipt_count: number;
}

export interface SuspicionTopSignal {
  name: string;
  value: number;
  contribution: number;
}

export interface SuspicionScore {
  player_id: string;
  session_id: string;
  score: number;
  band: SuspicionBand;
  top_signals: SuspicionTopSignal[];
  feature_version: string;
  model_version: string;
  computed_at: string;
  first_sequence: number;
  last_sequence: number;
  receipt_count: number;
}

export interface LearningModelManifest {
  model_version: string;
  feature_version: string;
  kind: 'heuristic';
  weights_checksum: string;
  generated_at: string;
}

export interface HeuristicRule {
  feature: keyof LearningFeatureRow;
  weight: number;
  scale: number;
}

export interface HeuristicConfig {
  model_version: string;
  feature_version: string;
  rules: HeuristicRule[];
}
