# Load Test Harness Specification

> **Scope**: Authorized local/staging environments only. Never production.

This document specifies the Akalynth load test harness for capacity discovery, SLO validation, and reproducible audit trails.

## Objectives

1. **Quantify capacity** (clients, msgs/sec, receipts/sec) under realistic workload mixes
2. **Detect breaking point**: First sustained SLO breach (not forced failure)
3. **Preserve proof value**: Every run is reproducible and attributable (commit + config → results → root hash)

---

## Safety Model

> **This harness is bounded by design and intended solely for authorized testing.**

The harness enforces a three-layer safety model to ensure it cannot be misused:

### Layer 1: Production Environment Refusal

The harness refuses to start if either environment variable is set:
- `NODE_ENV=production`
- `AKALYNTH_ENV=production`

This check occurs at the earliest entrypoint, before any network I/O.

### Layer 2: Pre-Resolve Hostname Allowlist

Only these hostnames are permitted as targets:
- `localhost`
- `127.0.0.1`
- `::1`
- `0.0.0.0` (normalized to `127.0.0.1` for client connections)

Staging IPs can be added via `LOADTEST_STAGING_HOSTS` environment variable.
**Important**: Only IP literals are accepted, not hostnames.

```bash
# Example: allow staging server at 10.0.1.50
LOADTEST_STAGING_HOSTS=10.0.1.50,10.0.1.51
```

### Layer 3: Post-Resolve IP Validation

For hostnames (like `localhost`), the harness resolves them to IPs and validates:
- Loopback addresses are always allowed: `127.x.x.x`, `::1`
- Staging IPs from `LOADTEST_STAGING_HOSTS` are allowed
- **All other IPs are rejected**

This prevents DNS rebinding attacks where a hostname resolves to an unexpected IP.

### Global Rate Limiting (Hard Cap)

The harness enforces a **hard** global send rate using a token bucket algorithm:
- Even if 100 clients all want to send simultaneously, the harness will not exceed `global_msg_sec`
- Excess sends are delayed (human-like behavior)
- If delay would exceed 5 seconds, the send is dropped and counted as `global_rate_limited_sends`
- This prevents accidental overwhelming of dev boxes or CI runners

### Expected Safety Failures

```bash
# Production environment blocked
$ NODE_ENV=production npm run loadtest -- run -s movement-heavy
Error: SAFETY: Load test harness refuses to run in production environment

# Non-allowlisted host blocked
$ npm run loadtest -- run -s movement-heavy --server ws://example.com:3000
Error: SAFETY: Server address 'example.com' not in allowed list.

# Hostname resolving to non-loopback blocked
$ npm run loadtest -- run -s movement-heavy --server ws://my-staging.internal:3000
Error: SAFETY: Hostname 'my-staging.internal' resolves to '203.0.113.50' which is not in allowed IP list.
```

---

## 1. Safety Envelope (Hard Limits)

### Allowed Environments

| Environment | Allowed | Notes |
|-------------|---------|-------|
| Local dev machine | Yes | Primary target |
| Staging (private network) | Yes | Allowlisted IPs only |
| Production | **NEVER** | Harness refuses to run |
| Public/uncontrolled networks | **NEVER** | Hard-coded rejection |

### Hard Caps (Enforced by Harness)

| Control | Default | Purpose |
|---------|---------|---------|
| Max clients | 10→25→50→75→100 (step) | Progressive discovery |
| Per-client send ceiling | 3-10 msgs/sec | Human-like pacing |
| Global send ceiling | 200-1000 msgs/sec | Prevent runaway pressure |
| Max run duration | 120s per plateau | Predictable bounds |
| Reconnect rate ceiling | 1 per 10s per client | Avoid connect storms |

### Stop Conditions (Kill Switch)

A run auto-stops and records breach when **sustained** (>10s continuous):

| SLO | Threshold | Reason |
|-----|-----------|--------|
| Tick p95 | > 250ms | Server falling behind |
| Receipt append p95 | > 100ms | Audit bottleneck |
| Heap growth slope | > 50 MB/min | Memory leak |
| CPU utilization | > 90% for 30s | Saturation |
| WS disconnect rate | > 10% in 60s window | Connection instability |
| Fatal log signature | Any match | Server crash |

**Breaking point**: First plateau where an SLO breach is sustained.

---

## 2. Workload Scenarios

### Scenario A: Movement-Heavy

```yaml
name: movement-heavy
description: Simulates exploration/grinding zones
mix:
  move_intent: 70%
  idle: 20%
  chat: 10%
think_time:
  min_ms: 120
  max_ms: 450
```

### Scenario B: Chatty Social Zone

```yaml
name: chatty
description: Simulates town squares and social hubs
mix:
  chat: 50%
  move_intent: 30%
  world_state: 20%
think_time:
  min_ms: 250
  max_ms: 1200
```

### Scenario C: Edge-Path Lifecycle

```yaml
name: edge-path
description: Tests session lifecycle stability
sequence:
  - login
  - enter_world
  - activity_burst (5-15 actions)
  - logout
  - wait (2000-8000ms)
  - reconnect
purpose: Validate session lifecycle, receipt correctness, DB pressure
```

### Scenario D: Tem-Path Verification

```yaml
name: tem-path
description: Controlled anti-cheat trigger verification
behavior:
  - Normal movement with occasional perfect-cadence bursts
  - Triggers TEM challenge at controlled rate
verify:
  - Challenge issued deterministically
  - Solve/verify latency stable
  - Cooldown and escalation correct
```

---

## 3. Metrics Collection

### Core Runtime SLOs

| Metric | Collection | Target |
|--------|------------|--------|
| `tick_duration_ms` | Server instrumentation | p95 < 250ms |
| `event_loop_lag_ms` | Node.js perf_hooks | p95 < 50ms |
| `cpu_percent` | process.cpuUsage() | < 90% sustained |
| `heap_used_mb` | process.memoryUsage() | Stable (no leak) |
| `gc_pause_ms` | v8 GC hooks | p99 < 100ms |

### Protocol Throughput

| Metric | Collection |
|--------|------------|
| `inbound_msgs_per_sec` | Harness counter |
| `outbound_msgs_per_sec` | Server counter |
| `message_latency_ms` | Round-trip timing |
| `error_rate_by_type` | Harness aggregation |

### Proof/Audit Pipeline

| Metric | Collection |
|--------|------------|
| `receipts_per_sec` | File growth rate |
| `receipt_append_latency_ms` | Server instrumentation |
| `audit_file_size_mb` | File stat |
| `db_query_latency_ms` | SQLite instrumentation |

### Tem Enforcement

| Metric | Collection |
|--------|------------|
| `challenges_per_sec` | Server counter |
| `challenge_resolution_ms` | Harness timing |
| `challenge_fail_rate` | Harness aggregation |
| `throttle_events` | Server counter |

---

## 4. Test Methodology

### Step Test (Primary)

```
Plateaus: 10 → 25 → 50 → 75 → 100 clients

Per plateau:
├── Warmup: 10s (ramp to target client count)
├── Hold: 60-120s (steady state measurement)
└── Cooldown: 10s (graceful disconnect)

After each plateau:
├── Record metrics summary
├── Compare to SLO thresholds
└── Stop if sustained breach
```

### Soak Test (Secondary)

```
Prerequisites: Step test identified safe ceiling

Duration: 30-60 minutes
Client count: ~70% of breaking point
Purpose: Detect slow leaks, drift, receipt growth stability
```

---

## 5. Run Artifacts (Proof-Native)

### One-Command Run

Run from `tools/loadtest/`. When passing flags, include the `run` subcommand
explicitly (the CLI only auto-inserts `run` when the first argument is a bare
scenario name, not a flag):

```bash
cd tools/loadtest
npm run loadtest -- run \
  --scenario movement-heavy \
  --clients 50 \
  --duration 120s \
  --seed 42 \
  --server ws://localhost:3000
```

Other subcommands:

```bash
npm run loadtest -- scenarios        # list available scenarios
npm run loadtest -- validate -s movement-heavy   # pre-flight config check
```

### Output Bundle Structure

```
runs/<run_id>/
├── RUN.json           # Configuration snapshot
├── RESULTS.json       # Metrics and verdict
├── METRICS.jsonl      # Time-series data
├── AUDIT_HASHES.json  # Integrity proofs
└── ROOT.txt           # Single root hash
```

### RUN.json Schema

```typescript
interface RunConfig {
  run_id: string;              // UUID
  git_sha: string;             // e.g., "2be6791"
  scenario: string;            // e.g., "movement-heavy"
  client_schedule: number[];   // e.g., [10, 25, 50]
  rate_caps: {
    per_client_msg_sec: number;
    global_msg_sec: number;
  };
  random_seed: number;
  server_addr: string;
  env_flags: string[];         // e.g., ["DEBUG=1", "ALLOW_INSECURE_LOCAL=1"]
  started_at: string;          // ISO8601
  harness_version: string;
}
```

### RESULTS.json Schema

```typescript
interface RunResults {
  run_id: string;
  verdict: 'pass' | 'fail';
  breach_reason?: string;      // Only if fail
  breaking_point_clients?: number;

  metrics_summary: {
    tick_duration_ms: Percentiles;
    event_loop_lag_ms: Percentiles;
    message_latency_ms: Percentiles;
    receipts_per_sec: number;
    receipt_append_latency_ms: Percentiles;
    peak_memory_mb: number;
    total_messages_sent: number;
    total_messages_received: number;
    total_errors: number;
  };

  per_plateau: PlateauResult[];
  ended_at: string;
  duration_sec: number;
}

interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

interface PlateauResult {
  client_count: number;
  verdict: 'pass' | 'fail';
  breach_reason?: string;
  metrics: MetricsSummary;
}
```

### AUDIT_HASHES.json Schema

```typescript
interface AuditHashes {
  run_json_hash: string;       // SHA-256 (hex)
  results_json_hash: string;   // SHA-256 (hex)
  metrics_jsonl_hash: string;  // SHA-256 (hex)
  server_receipts_hash?: string; // If accessible
}
```

> Implementation note: hashes are computed with SHA-256 for portability (no
> native binding required). The `blake3` dependency is present but not used for
> these artifacts.

### ROOT.txt

Single line containing the SHA-256 hash over the serialized `AUDIT_HASHES.json`.

---

## 6. Implementation Location

```
tools/loadtest/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # CLI entry point (run / scenarios / validate)
│   ├── compare.ts         # Run comparison CLI (loadtest:compare)
│   ├── config.ts          # Configuration types, safety validation, defaults
│   ├── client.ts          # WebSocket client with think-time
│   ├── runner.ts          # Step test orchestrator
│   ├── metrics.ts         # Metrics collection and percentiles
│   ├── artifacts.ts       # Run bundle generation + hashing (SHA-256)
│   └── scenarios/
│       └── index.ts       # Scenario registry + all four scenario impls
│                          # (movement-heavy, chatty, edge-path, tem-path)
└── runs/                  # Output directory, created at runtime (gitignored)
```

---

## 7. CI Integration

### Smoke Test (Required)

```yaml
# .github/workflows/ci.yml addition
loadtest-smoke:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
    - name: Install dependencies
      run: |
        cd apps/server && npm ci
        cd ../../tools/loadtest && npm ci
    - name: Start server
      run: |
        cd apps/server
        DEBUG=1 ALLOW_INSECURE_LOCAL=1 npm start &
        sleep 5
    - name: Run smoke test
      run: |
        cd tools/loadtest
        npm run loadtest -- run \
          --scenario movement-heavy \
          --clients 5 \
          --duration 30s \
          --seed 12345
```

### Nightly Capacity Test (Optional)

```yaml
schedule:
  - cron: '0 3 * * *'  # 3 AM UTC

steps:
  - name: Full capacity test
    run: |
      npm run loadtest -- run \
        --scenario movement-heavy \
        --step-test \
        --max-clients 100
  - name: Upload artifacts
    uses: actions/upload-artifact@v4
    with:
      name: loadtest-results
      path: tools/loadtest/runs/
```

---

## 8. Usage Examples

All examples below run from `tools/loadtest/`.

### Find Breaking Point

```bash
cd tools/loadtest
npm run loadtest -- run \
  --step-test \
  --scenario movement-heavy \
  --max-clients 100 \
  --plateau-duration 60s \
  --seed 42
```

### Soak Test at Safe Ceiling

```bash
npm run loadtest -- run \
  --scenario movement-heavy \
  --clients 40 \
  --duration 1800s \
  --seed 42
```

### Verify Tem Path

```bash
npm run loadtest -- run \
  --scenario tem-path \
  --clients 10 \
  --duration 60s \
  --verify-tem
```

### Compare Across Commits

```bash
# Run on commit A
git checkout abc123
npm run loadtest -- run --scenario movement-heavy --step-test

# Run on commit B
git checkout def456
npm run loadtest -- run --scenario movement-heavy --step-test

# Compare two run bundles by directory
npm run loadtest:compare -- runs/<run_id_A> runs/<run_id_B>
```

---

## 9. Interpreting Results

### Understanding the Verdict

| Field | Meaning |
|-------|---------|
| `verdict: pass` | All plateaus completed without sustained SLO breach |
| `verdict: fail` | At least one SLO was breached for >10s continuously |
| `breaking_point_clients` | Client count at which breach occurred |
| `breach_reason` | Format: `<metric>: <value> > <threshold> for <duration>s` |

### Example Breach Reasons

```
tick_p95_ms: 312.50 > 250 for 10.5s
  → Server tick loop falling behind (95th percentile exceeds 250ms)

cpu_percent_sustained: 94.20 > 90 for 30.0s
  → CPU saturated for extended period

heap_growth_mb_per_min: 62.30 > 50 for 10.0s
  → Possible memory leak detected

disconnect_rate_percent: 15.40 > 10 for 10.0s
  → Connection instability under load
```

### Server Saturation vs Harness Saturation

**Critical distinction** — when throughput flattens, check which limit was hit:

| Symptom | Cause | Evidence | Action |
|---------|-------|----------|--------|
| Low throughput, `global_rate_limited_sends > 0` | **Harness saturation** | Harness hit its own rate cap | Increase `global_msg_sec` or reduce client count |
| Low throughput, `global_rate_limited_sends = 0` | **Server saturation** | Server can't keep up | This is the real breaking point |

**Rule of thumb**: If `global_rate_limited_sends` is non-zero, you're measuring the harness, not the server.

### Reading the Metrics Summary

```json
{
  "tick_duration_ms": { "p50": 45, "p95": 120, "p99": 180, "max": 450 },
  "message_latency_ms": { "p50": 12, "p95": 35, "p99": 85, "max": 200 },
  "global_rate_limited_sends": 0,      // ← Should be 0 for valid server measurement
  "global_send_queue_depth_max": 3     // ← Low = harness keeping up
}
```

**Healthy indicators**:
- `tick_duration_ms.p95 < 250` (server processing within budget)
- `message_latency_ms.p95 < 100` (responsive under load)
- `global_rate_limited_sends = 0` (harness not the bottleneck)
- `peak_memory_mb` stable across plateaus (no leaks)

### Comparing Runs

When using `loadtest:compare`, look for:

| Change | Interpretation |
|--------|---------------|
| `tick_p95` +20% | Performance regression (investigate recent commits) |
| `receipts_per_sec` -15% | Audit pipeline slowdown |
| `breaking_point_clients` 75→50 | Significant capacity regression |
| `message_latency_ms.p99` 2x | Tail latency issue (possible GC pauses) |

### Common Pitfalls

1. **Running with `DEBUG=1` in capacity tests** — Debug logging adds overhead; results won't reflect production
2. **Ignoring `global_rate_limited_sends`** — Non-zero means harness bottleneck, not server bottleneck
3. **Short plateau durations** — <60s may not catch slow-building issues like memory leaks
4. **Comparing runs with different seeds** — Use same `--seed` for reproducible comparison

---

## 10. Security Notes

1. **Environment validation**: Harness validates `NODE_ENV !== 'production'` before starting
2. **Address allowlist**: Only `localhost`, `127.0.0.1`, `::1`, and configured staging IPs
3. **No credential storage**: Harness uses ephemeral guest sessions only
4. **Rate limiting**: Harness respects and validates against server rate limits
5. **Audit trail**: All runs produce immutable, hashable artifacts

---

## 11. Related Documents

- [MVP Verification Report](./archive/MVP_VERIFICATION_REPORT_v1.md) - archived point-in-time verification record
- [Architecture](./ARCHITECTURE.md) - Server design
- [Protocol](./PROTOCOL.md) - Message specifications
- [Anti-Cheat](./ANTICHEAT.md) - Tem and heat system
