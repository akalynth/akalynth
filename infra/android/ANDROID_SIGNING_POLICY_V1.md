# AKALYNTH_ANDROID_SIGNING_POLICY_V1

Tracked signing and update authority contract for Akalynth Android Beta. This document freezes trust rules before self-update implementation. It does not authorize signing, keystore access, builds, or publish actions.

**Policy ID:** `AKALYNTH_ANDROID_SIGNING_POLICY_V1`  
**Adopted:** 2026-07-08  
**Status:** adopted (contract only; not yet enforced in client)

---

## 1. Package and application identity

| Field | Value |
|-------|-------|
| `applicationId` / package name | `com.akalynth.client` |
| Namespace | `com.akalynth.client` |
| Application label (`@string/app_name`) | `Akalynth` |
| Beta launcher activity label | `Create Character` (`CharacterCreateActivity`, beta flavor manifest) |
| Intended public app name | `Akalynth` |
| Beta public naming | `Akalynth Beta` (launcher/display; not yet applied) |
| Release public naming | `Akalynth` |

**Naming distinction:** Beta builds share `applicationId` with release. Beta is distinguished by `versionName` suffix (`*-beta-*`), beta API endpoints, and (when applied) launcher label `Akalynth Beta`. F-Droid card name is currently `Akalynth` without a Beta suffix.

---

## 2. Supported distribution channels

| Channel ID | Description | Update authority |
|------------|-------------|------------------|
| `fdroid` | Akalynth F-Droid repo (`https://fdroid.akalynth.com/fdroid/repo`) | F-Droid client |
| `direct` | Direct APK / beta download URL (`https://beta.akalynth.com/download/akalynth-beta.apk`) | Live update metadata + user-approved Package Installer |
| `dev_local` | Local Gradle `assembleBeta` / `assembleDebug` install | None (manual reinstall only) |
| `unknown_sideload` | APK installed from unknown source | None (instructions only; no silent update) |

---

## 3. Signing authority (observed)

### Direct / beta channel (current v11)

- **APK SHA-256:** `99be43cf5467746f7f768ef7172cde617acb866b7546c34974d1ec35658bc1ac`
- **Observed signing certificate SHA-256 (APK Signing Block v2/v3):** `df2acbbf9140f61507623b68268372ee368c7abf0c070a613c47bb791787d5cd`
- **Extraction method:** Python parse of APK Signing Block (host lacks `apksigner` / `java` at adoption time). Re-verify with `apksigner verify --print-certs` when Android SDK tools are available.

### F-Droid channel (current index)

- **APK SHA-256:** `da7086149d0c3eb64dc72411a19e8dd91c8e454c0ac4d6ff5b15e567318b0bdc`
- **Observed signing certificate SHA-256:** `b58026521f3df84808a2d18d586267c5d4021557ab82e016e5639dad2ab91442` (matches F-Droid index `signer` field)

### Authority statements

- **Private signing keys were not accessed** during policy adoption.
- **No signing action occurred** during policy adoption.
- **Signing key custody was not inspected.**

**Critical observation:** Direct v11 and F-Droid v5 APKs are signed with **different** certificate fingerprints. Android Package Installer will treat cross-channel APKs as incompatible for in-place upgrade unless keys are aligned.

---

## 4. Version policy

1. `versionCode` **must increase** for every normal production/beta update on a given signing authority.
2. **Downgrade is forbidden** except in an explicit `dev_local` / debug lane where the operator accepts data loss risk.
3. `versionName` **must match** update metadata (`beta-client-update.json`, live `/v1/client/android-update`, and F-Droid index when refreshed).
4. Channel metadata version fields must not disagree on the same signing authority (e.g. direct API and www APK sidecar must agree).

**Observed versions at adoption:**

| Channel | versionCode | versionName |
|---------|-------------|-------------|
| Direct / live API / www | 11 | `0.1.9-beta-outfit-colors` |
| F-Droid index | 5 | `0.1.3-beta-harvest` |
| Gradle `defaultConfig` (source) | 11 | `0.1.9-beta-outfit-colors` |

---

## 5. Update verification policy

Before any update is offered or claimed successful, the client (or operator tooling) must enforce:

1. **Package name** equals expected `applicationId` (`com.akalynth.client`).
2. **versionCode** of candidate APK is **greater than** installed `versionCode` (except explicit dev/debug lane).
3. **APK SHA-256** of downloaded bytes equals metadata `apk_sha256` / `apkSha256`.
4. **Signature continuity** is enforced by Android Package Installer (same signing certificate as installed app, or fresh install after uninstall).
5. **No success claim** until installed `versionCode` is observed after restart/reopen post-install.
6. **No silent install** — user must approve download and Package Installer prompt.
7. **No bypass** of Android Package Installer.

Existing `ClientUpdateController` already checks `versionCode` and SHA-256 before invoking `ApkInstaller`; policy adoption does not change that behavior.

---

## 6. Metadata contract

Required fields for direct-channel update manifests:

| Field | Required | Notes |
|-------|----------|-------|
| `channel` / `lane` | yes | `beta`, `staging`, etc. |
| `versionCode` / `version_code` | yes | Integer, monotonic per signing authority |
| `versionName` / `version_name` | yes | Human-readable; matches built APK |
| `apkUrl` / `apk_url` | yes | HTTPS URL to APK |
| `apkSha256` / `apk_sha256` | yes | Lowercase hex SHA-256 of APK file |
| `releaseNotes` | recommended | Not yet in live API; add when self-update UX ships |
| `publishedAt` / `published_at` | yes | ISO-8601 timestamp |
| `compatible_server_commit` or `min_server_commit` | optional | If used, documents minimum server build for client compatibility |
| `signingCertificateSha256` | recommended | Observed cert fingerprint for the advertised APK |

F-Droid index supplies parallel fields (`hash`, `signer`, `versionCode`, `versionName`) and must be refreshed to match direct channel when signing authorities are aligned.

**Live beta manifest source:** `infra/android/beta-client-update.json` (served via `AKALYNTH_ANDROID_BETA_UPDATE_JSON` on beta server).

---

## 7. F-Droid relationship

1. Apps **installed from F-Droid** must **prefer the F-Droid update flow** (open F-Droid / repo refresh).
2. Direct APK self-update **must not silently override** F-Droid update authority.
3. When F-Droid repo is refreshed, **versionCode, versionName, APK SHA-256, and signer** must align with the published APK for that signing authority.
4. Until F-Droid and direct channels share the same signing certificate and version line, cross-channel updates are **unsupported** and may require uninstall/reinstall.

---

## 8. Direct APK relationship

1. Direct/sideload installs (non-F-Droid) may query live update metadata (`GET /v1/client/android-update?lane=beta`).
2. APK download requires **explicit user approval**.
3. **No silent install.**
4. **No bypass** of Android Package Installer.
5. Install-source detection (planned) gates which update path is offered.

---

## 9. Key rotation policy

1. Key rotation requires a **new policy version** (e.g. `AKALYNTH_ANDROID_SIGNING_POLICY_V2`).
2. Document **old and new certificate SHA-256 fingerprints** and effective date.
3. State **update compatibility impact:**
   - In-place upgrade requires matching signing certificate.
   - Rotation forces uninstall + reinstall OR a documented migration window with dual-signer support (not currently implemented).
4. All channels (F-Droid, direct metadata, www APK) must rotate together or document explicit per-channel authority.

---

## 10. Explicit non-claims

- v11 APK was **not** verified as built from clean commit `a5530b92c36be8ecb1e060d0ef69719b76188560`.
- Signing key custody was **not** inspected.
- F-Droid and direct channels are **not** aligned (v5 vs v11; different signers).
- Self-update with install-source awareness is **not** implemented yet.
- Beta launcher label rename to `Akalynth Beta` is **not** applied yet.

---

## 11. Machine-readable companion

Canonical JSON: `infra/android/android-signing-policy.v1.json`

## 12. Verification commands (at adoption)

These commands were used (or would be used) for policy facts. Only pre-existing tooling + read-only ops.

```bash
# APK hash verification (matches custody 99be43cf...)
sha256sum apps/android/app/build/outputs/apk/beta/app-beta.apk

# Live direct update metadata
curl -s 'https://beta-api.akalynth.com/v1/client/android-update?lane=beta' | python3 -m json.tool

# F-Droid index facts (current v5)
curl -sL 'https://fdroid.akalynth.com/fdroid/repo/index-v1.json' | python3 -c '
import sys,json; d=json.load(sys.stdin); 
print([ (p.get("versionCode"), p.get("versionName"), p.get("hash")) 
  for p in d.get("packages",{}).get("com.akalynth.client",[])[:1] ])
'

# Package identity from sources (read only)
grep -E 'applicationId|versionCode|versionName|app_name|label=' apps/android/app/build.gradle.kts apps/android/app/src/*/AndroidManifest.xml apps/android/app/src/main/res/values/strings.xml

# Git hygiene (policy area only)
git status --porcelain infra/android/ANDROID_SIGNING_POLICY_V1.md infra/android/android-signing-policy.v1.json
git diff --stat -- infra/android/ANDROID_SIGNING_POLICY_V1.md infra/android/android-signing-policy.v1.json

# Signing cert (when tools available; not present at adoption)
# apksigner verify --print-certs --verbose <apk>
# keytool -printcert -jarfile <apk>   # requires java + SDK
```

**Note on cert extraction:** No `apksigner`, `java`, `apkanalyzer`, or `keytool` in PATH on host at adoption time. v2/v3 APK scheme has no standalone META-INF/*.RSA. Fingerprint recorded from prior extraction on matching-SHA APK. Re-audit with SDK tools before any rotation or self-update enforcement.