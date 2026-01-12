Run the repo verification checklist (MVP).

1) Server boots:
!cd apps/server && npm run dev

2) WebSocket connect (in another terminal if needed):
Use wscat and send:
{"type":"connect"}
{"type":"login","guest_token":null}
{"type":"enter_world"}

3) Confirm JSONL receipts are being written (show file path and last 5 lines).

4) Trigger Tem challenge by intentionally violating movement interval and confirm challenge receipt exists.

Return a pass/fail table.
