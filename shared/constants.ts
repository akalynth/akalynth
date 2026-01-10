// Shared timing constants (server + client)

export const TICK_MS = 100;
export const MIN_MOVE_INTERVAL_MS = TICK_MS; // one move per tick
export const TEM_TIMEOUT_SECONDS = 15;

// Perfect cadence detection thresholds
export const CADENCE_WINDOW_N = 12;
export const CADENCE_MEAN_MIN_MS = 80;
export const CADENCE_MEAN_MAX_MS = 400;
export const CADENCE_STDDEV_MAX_MS = 6;
export const CADENCE_IDLE_RESET_MS = 5000;

