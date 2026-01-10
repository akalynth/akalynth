// Shared timing constants (server + client)

export const TICK_MS = 100;
export const MIN_MOVE_INTERVAL_MS = TICK_MS; // one move per tick
export const TEM_TIMEOUT_SECONDS = 15;

// Perfect cadence detection thresholds (configurable via env)
export const CADENCE_WINDOW_N = parseInt(process.env.CADENCE_WINDOW_N ?? '20', 10);
export const CADENCE_MIN_SAMPLES = parseInt(process.env.CADENCE_MIN_SAMPLES ?? '12', 10);
export const CADENCE_STDDEV_MAX_MS = parseFloat(process.env.CADENCE_STDDEV_MAX_MS ?? '2');
export const CADENCE_MEAN_TARGET_MS = TICK_MS;
export const CADENCE_MEAN_TOLERANCE_MS = parseInt(process.env.CADENCE_MEAN_TOLERANCE_MS ?? '8', 10);
export const CADENCE_COOLDOWN_MS = parseInt(process.env.CADENCE_COOLDOWN_MS ?? '60000', 10);
export const CADENCE_IDLE_RESET_MS = 5000;

