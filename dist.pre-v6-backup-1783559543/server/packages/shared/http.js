// packages/shared/http.ts
// HTTP Control Plane contract (API-first). Keep stable.
export function normalizeMapName(value) {
    if (value === 'Rookguard')
        return 'Rookguard';
    if (value === 'Azura' || value === 'HighCity')
        return 'Azura';
    return null;
}
export function isAcceptedMapName(value) {
    return normalizeMapName(value) !== null;
}
export function displayMapName(value) {
    if (value === 'Azura' || value === 'HighCity')
        return 'High City';
    if (value === 'Rookguard')
        return 'Rookguard';
    return value;
}
