# AKALYNTH_IDENTITY_SEAL_ACCOUNTLESS_AUTH_V1 Acceptance Gates

- BLOCKER_1: No Play Store candidate until in-app report content, report principal, block principal, and moderation queue exist.
- BLOCKER_2: No Play Store candidate until Seal retirement/deletion exists in-app and a public web deletion request URL exists.
- BLOCKER_3: No public authority claims until PGP verification over canonical payloads is implemented and tested.
- BLOCKER_4: No key recovery claim in V1. Lost local key means lost Seal unless a later recovery lane ships.
- BLOCKER_5: No wording that claims a legal person is verified. Use "signed", "key-bound", or "PGP-bound".
- BLOCKER_6: No wallet/token/blockchain/NFT language unless a separate blockchain policy lane is opened.
- BLOCKER_7: No Play Store candidate until privacy policy, Data Safety inputs, in-app privacy disclosure, and public deletion web path are present and internally reviewed.
- BLOCKER_8: No public release until Adventurer Seal creation explicitly states what is stored locally, what is sent to server, what is public, and what happens if device/app data is lost.
- BLOCKER_9: No moderation authority action may be accepted from client-submitted role/capability fields.

Current branch status:

- Server principal/challenge/session/report/block/moderation/deletion primitives: implemented.
- Android Seal creation/login/report/block/retire/delete screen: implemented as an additive identity surface.
- PGP authority: not enabled; PGP public-key intake remains pending and does not grant authority.
- Public privacy policy URL and public deletion web path: release-blocking follow-up outside this no-deploy branch.
