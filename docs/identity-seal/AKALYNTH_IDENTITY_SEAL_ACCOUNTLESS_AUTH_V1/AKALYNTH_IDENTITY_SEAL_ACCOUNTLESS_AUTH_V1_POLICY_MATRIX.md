# AKALYNTH_IDENTITY_SEAL_ACCOUNTLESS_AUTH_V1 Policy Matrix

| Area | Requirement | V1 Handling |
| --- | --- | --- |
| Persistent identity | Treat Adventurer Seal as likely app-account identity | In-app disclosure and deletion/retirement endpoints are required |
| Account deletion | In-app path and public web request path | API and Android controls exist; public site URL is a release gate |
| Privacy policy | Public, non-PDF, non-geofenced, non-editable policy and in-app disclosure | Privacy data map is a required build artifact; publication is a release gate |
| Data Safety | Declare handle, public key fingerprint, posts/reports/blocks/sessions/logs as applicable | Data map enumerates inputs for Play Console |
| UGC | Terms, objectionable-content rules, report, block, moderation, action against abuse | Principal terms, report, block, and moderation endpoints/UI are added |
| Authority | No authority from client-submitted roles/capabilities | Server derives capabilities from persisted principal roles |
| PGP | Signature proves key-controlled authorship continuity, not trust | PGP binding remains pending until real detached-signature verification ships |
| Blockchain | Avoid wallet/token/NFT/blockchain language | Identity Seal uses public-key language only |

Policy anchors:

- Google Play UGC: https://support.google.com/googleplay/android-developer/answer/9876937
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- User data/privacy: https://support.google.com/googleplay/android-developer/answer/10144311
- Blockchain-based content: https://support.google.com/googleplay/android-developer/answer/13607354
