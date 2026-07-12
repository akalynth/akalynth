// Akalynth Property Auction close→settle (Step 4b).
//
// This is the ONLY auction wall-clock surface. `now` is INJECTED — this module
// never calls Date.now() itself; the live world tick loop passes Date.now().
// Replay NEVER runs this loop: it consumes the emitted `property_auction_settled`
// receipts through the pure reducer, which has no clock. Settlement truth is the
// receipt, not the clock.
//
// Scope (4b): only auctions that 4a can open (owner/resale) reach settlement.
// Primary/system auction opening is a separate later lane.
import { getOpenAuctions, getProperty, } from './property.js';
import { WALLET_CREDIT_ACTION, PROPERTY_AUCTION_SETTLED_ACTION, } from '../../../../packages/shared/types.js';
// Auction window bounds (applied by the LIVE open handler when recording the
// absolute close; not reducer truth).
export const AUCTION_MIN_DURATION_S = 60; // 1 minute
export const AUCTION_MAX_DURATION_S = 7 * 24 * 3600; // 7 days
export function clampAuctionDurationS(durationS) {
    const n = typeof durationS === 'number' && Number.isFinite(durationS)
        ? Math.floor(durationS)
        : AUCTION_MIN_DURATION_S;
    return Math.min(AUCTION_MAX_DURATION_S, Math.max(AUCTION_MIN_DURATION_S, n));
}
/**
 * Emit settlement receipts for every OPEN auction whose recorded close has
 * passed relative to the INJECTED `nowMs`.
 *
 * Idempotent: `getOpenAuctions()` returns only `status === 'open'`, and each
 * settle flips the auction to `'settled'` synchronously via the write hook, so a
 * repeated pass (or a later tick) does not double-settle. Auctions with no
 * recorded close (`scheduled_close_ms == null`) never auto-close here.
 *
 * Returns summaries so the caller can broadcast `house_auction_settled`.
 */
export function settleDueAuctions(nowMs, writeReceipt) {
    const settled = [];
    for (const auction of getOpenAuctions()) {
        if (auction.scheduled_close_ms == null)
            continue; // no recorded close
        if (nowMs < auction.scheduled_close_ms)
            continue; // not yet due
        const prop = getProperty(auction.property_id);
        if (!prop)
            continue;
        const winnerId = auction.high_bidder_id; // null = no bids
        const price = auction.current_high ?? 0;
        // Resale winner: release the winner's escrow to the seller (conserved).
        // No-bid close emits NO wallet movement. Primary is out of scope for 4b.
        if (winnerId && auction.kind === 'resale' && auction.seller_id) {
            writeReceipt({
                actor_id: auction.seller_id,
                action: WALLET_CREDIT_ACTION,
                inputs: { amount: price, reason: `auction_sale:${auction.property_id}` },
                result: 'ok',
            });
        }
        // Settlement truth: winner/price/seller recorded explicitly in the receipt.
        writeReceipt({
            actor_id: winnerId ?? 'system',
            action: PROPERTY_AUCTION_SETTLED_ACTION,
            inputs: {
                property_id: auction.property_id,
                plot_id: prop.plot_id,
                kind: auction.kind,
                winner_id: winnerId,
                seller_id: auction.seller_id,
                price, // gold amount the auction settled at
                scheduled_close_ms: auction.scheduled_close_ms, // close reference
            },
            result: 'ok',
        });
        const updated = getProperty(auction.property_id);
        settled.push({
            property_id: auction.property_id,
            plot_id: prop.plot_id,
            zone: prop.zone,
            kind: auction.kind,
            winner_id: winnerId,
            seller_id: auction.seller_id,
            price,
            sale_count: updated ? updated.sale_count : prop.sale_count,
        });
    }
    return settled;
}
