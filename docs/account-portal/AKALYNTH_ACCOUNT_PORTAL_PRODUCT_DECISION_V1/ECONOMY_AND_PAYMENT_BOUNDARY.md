# Economy & Payment Boundary

Decision: **in-game currency first. No real-money payments in V1.**

## In scope (V1)

- The shop and houses use the **server-authoritative game economy** only:
  in-game gold/coins earned and spent in-world.
- The server already has property/house, gold, shop, and treasury logic; V1 connects
  it to **accounts** and the **website**, it does not invent a new currency.
- Houses portal (V1): **fixed-price / resale** flows first. **Auctions remain blocked**
  until the server auction verifier lanes fully pass.
- Shop portal (V1): spend in-game currency. No premium/real-money tier.

## Explicitly deferred (later gated epic)

- **Stripe / real-money payments.**
- **Real-money-purchasable premium currency** (e.g. Azura coins for cash).
- PCI scope, payment ledgers, refunds, chargebacks, tax — all deferred with payments.

## Overclaim guard

- The website and clients must **not advertise** a live real-money shop, premium
  purchase, or auction until those server lanes exist and pass. Copy stays honest:
  in-game currency now; premium "coming later".

## Receipts

- Economy lifecycle events (purchase, house buy/list/transfer, currency grant/spend)
  are **receipt-backed** with stable IDs + amounts + linkage — never PII or secrets.
  See [RECEIPT_PRIVACY_BOUNDARY.md](./RECEIPT_PRIVACY_BOUNDARY.md).

## Why defer real money

Real-money payments add PCI/Stripe infrastructure, refund/dispute handling, financial
reconciliation, and legal/tax surface that should not block the account + character +
in-game economy from shipping. It becomes its own hardening-gated epic once the
account platform is stable.
