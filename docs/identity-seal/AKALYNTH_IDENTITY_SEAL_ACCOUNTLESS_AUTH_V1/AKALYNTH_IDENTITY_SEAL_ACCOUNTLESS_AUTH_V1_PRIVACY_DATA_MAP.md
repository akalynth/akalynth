# AKALYNTH_IDENTITY_SEAL_ACCOUNTLESS_AUTH_V1 Privacy Data Map

Local device data:

- Android Keystore private signing key, device-bound where available.
- Public key cached only as needed for registration.
- Principal id, handle, principal session token, session expiry in app preferences.

Server data:

- Principal id, handle, display name.
- Device public key and public key fingerprint.
- Pending PGP public key and fingerprint, if submitted.
- Principal status, roles, server-derived capabilities, recovery mode.
- Challenge metadata: challenge id, nonce hash, purpose, domain, canonical payload, expiry, consumed timestamp.
- Hashed principal session tokens and session metadata.
- Terms acceptance version, client, timestamp.
- Blocks, reports, moderation actions, deletion/retirement state.

Potential public data:

- Handle/display name.
- Post authorship status such as unsigned/key-bound/signed/project-signed.
- Public posts and signed-post metadata if forum surfaces expose them.

Retained evidence:

- Public posts, reports, moderation records, and abuse-prevention records may be retained only if disclosed in the privacy and data-retention policy.

Not collected by this lane:

- Email, password, phone number, contacts, precise location, advertising id, legal identity, wallet address, tokenized asset id, private key, raw recovery secret.

Required disclosure text:

V1 has no recovery. If the device or app data is lost, the Adventurer Seal may be lost. The server stores the public identity record and public key fingerprint, not the private key.
