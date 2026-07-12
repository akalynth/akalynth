import fs from 'node:fs';
export function createAntiCheatPriorStore(config) {
    let cache = new Map();
    let cacheKey = null;
    function currentCacheKey() {
        if (!config.filePath)
            return 'missing';
        const stat = fs.statSync(config.filePath);
        return `${stat.mtimeMs}:${stat.size}`;
    }
    function loadIfNeeded() {
        if (!config.filePath)
            return;
        const nextKey = currentCacheKey();
        if (cacheKey === nextKey)
            return;
        const nextCache = new Map();
        const content = fs.readFileSync(config.filePath, 'utf8');
        const lines = content.split('\n').filter((line) => line.trim().length > 0);
        for (const line of lines) {
            const parsed = parsePriorLine(line);
            nextCache.set(parsed.player_id, parsed);
        }
        cache = nextCache;
        cacheKey = nextKey;
    }
    return {
        queryPlayerPrior(playerId) {
            if (!config.enabled) {
                return { error: 'forbidden', status: 403 };
            }
            if (!config.filePath) {
                return { error: 'not_configured', status: 404 };
            }
            if (!fs.existsSync(config.filePath)) {
                return { error: 'not_found', status: 404 };
            }
            try {
                loadIfNeeded();
            }
            catch {
                return { error: 'prior_store_unavailable', status: 500 };
            }
            const prior = cache.get(playerId);
            if (!prior) {
                return { error: 'not_found', status: 404 };
            }
            return { prior };
        },
    };
}
function parsePriorLine(line) {
    let raw;
    try {
        raw = JSON.parse(line);
    }
    catch {
        throw new Error(`Invalid JSONL prior record: ${line}`);
    }
    const record = raw;
    const topSignals = Array.isArray(record.top_signals)
        ? record.top_signals.map((entry) => normalizeTopSignal(entry))
        : [];
    const band = record.band;
    if (band !== 'low' && band !== 'medium' && band !== 'high') {
        throw new Error('Prior record is missing a valid band');
    }
    return {
        player_id: requireString(record.player_id, 'player_id'),
        session_id: requireString(record.session_id, 'session_id'),
        score: requireFiniteNumber(record.score, 'score'),
        band,
        top_signals: topSignals,
        feature_version: requireString(record.feature_version, 'feature_version'),
        model_version: requireString(record.model_version, 'model_version'),
        computed_at: requireString(record.computed_at, 'computed_at'),
        first_sequence: requireFiniteNumber(record.first_sequence, 'first_sequence'),
        last_sequence: requireFiniteNumber(record.last_sequence, 'last_sequence'),
        receipt_count: requireFiniteNumber(record.receipt_count, 'receipt_count'),
    };
}
function normalizeTopSignal(value) {
    const entry = value;
    return {
        name: requireString(entry.name, 'top_signals[].name'),
        value: requireFiniteNumber(entry.value, 'top_signals[].value'),
        contribution: requireFiniteNumber(entry.contribution, 'top_signals[].contribution'),
    };
}
function requireString(value, name) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Prior record field ${name} must be a non-empty string`);
    }
    return value;
}
function requireFiniteNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Prior record field ${name} must be a finite number`);
    }
    return value;
}
