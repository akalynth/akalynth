import * as fs from 'node:fs';
export class LifecycleVerifierError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LifecycleVerifierError';
    }
}
export function parseLifecycleReceiptsText(text) {
    const receipts = [];
    let lineNo = 0;
    for (const line of text.split('\n')) {
        lineNo++;
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            receipts.push(JSON.parse(trimmed));
        }
        catch {
            throw new LifecycleVerifierError(`malformed JSONL at line ${lineNo}`);
        }
    }
    return receipts;
}
export function readLifecycleReceipts(file) {
    if (!fs.existsSync(file)) {
        throw new LifecycleVerifierError(`receipts file not found: ${file}`);
    }
    return parseLifecycleReceiptsText(fs.readFileSync(file, 'utf8'));
}
export function scopeLifecycleReceipts(receipts, fromSequence) {
    if (fromSequence === null || fromSequence === undefined)
        return receipts;
    const scoped = receipts.filter((r) => typeof r.sequence === 'number' && r.sequence >= fromSequence);
    if (scoped.length === 0) {
        throw new LifecycleVerifierError(`no receipts found at or after sequence ${fromSequence}`);
    }
    return scoped;
}
function isServerReceipt(r) {
    return r.action.startsWith('server_');
}
export function verifyLifecycleReceipts(receipts, options = {}) {
    const scoped = scopeLifecycleReceipts(receipts, options.fromSequence);
    const violations = [];
    let booted = false;
    let sawBoot = false;
    let lastSequence = 0;
    for (const r of scoped) {
        if (typeof r.sequence === 'number') {
            if (r.sequence <= lastSequence) {
                violations.push(`non-monotonic sequence at ${r.sequence}`);
            }
            lastSequence = r.sequence;
        }
        if (r.action === 'server_boot') {
            if (booted) {
                violations.push('double server_boot without intervening server_shutdown');
            }
            booted = true;
            sawBoot = true;
            continue;
        }
        if (r.action === 'server_shutdown') {
            if (!booted) {
                violations.push('server_shutdown before server_boot');
            }
            booted = false;
            continue;
        }
        if (isServerReceipt(r) && !booted) {
            violations.push(`server receipt before server_boot: ${r.action}`);
        }
    }
    return {
        violations,
        sawBoot,
        scopedFromSequence: options.fromSequence ?? null,
        receiptCount: scoped.length,
    };
}
export function verifyLifecycleReceiptFile(file, options = {}) {
    return verifyLifecycleReceipts(readLifecycleReceipts(file), options);
}
