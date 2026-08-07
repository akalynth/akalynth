# Beta client publish ladder v1

**Purpose:** Make beta `/play/` + direct Android APK publish **reproducible from `main`**, matching the live long-date version ladder.

**Related:** [`CLIENT_PLAY_SURFACE_CONTRACT_V1.md`](../CLIENT_PLAY_SURFACE_CONTRACT_V1.md), [`AKALYNTH_ANDROID_BETA_LONG_VERSION_V1`](../decisions/AKALYNTH_ANDROID_BETA_LONG_VERSION_V1/DECISION.md)

---

## 1. Source of truth

| Artifact | Path in monorepo | Live host path |
|----------|------------------|----------------|
| Play static | `apps/debug-client/dist/` after build | `/var/www/akalynth-beta/play/` |
| APK | `apps/android/app/build/outputs/apk/beta/app-beta.apk` | `/var/www/akalynth-beta/download/akalynth-beta-v{CODE}.apk` |
| Update manifest | `infra/android/beta-client-update.json` | `/opt/akalynth-beta/infra/android/beta-client-update.json` (read by beta API via `AKALYNTH_ANDROID_BETA_UPDATE_JSON`) |
| Server runtime | separate deploy | `/opt/akalynth-beta` + k8s `akalynth-game-beta` |

Client-only ships **do not require** a full server rebuild if protocol is unchanged. Always restart/reload whatever caches the Android update JSON.

---

## 2. Version bump (before build)

1. Read live:  
   `curl -sfS 'https://beta-api.akalynth.com/v1/client/android-update?lane=beta'`
2. Choose next `versionCode` **strictly greater** than live (prefer `YYYYMMDDNN`).
3. Update **both**:
   - `apps/android/app/build.gradle.kts` (`versionCode`, `versionName`)
   - `infra/android/beta-client-update.json` (code, name, url, sha256 after build, size, published_at)
4. Refuse publish if `versionCode <= live` (see `scripts/build-publish-beta-apk.sh`).

---

## 3. Build (from clean `main` checkout)

```bash
# on ops-dev-01, monorepo at intended SHA
git fetch origin && git checkout main && git reset --hard origin/main
git rev-parse HEAD   # record this

# Web /play
npm -w apps/debug-client run build
# assert no legacy stop class
! grep -R dpad-stop apps/debug-client/dist || true

# Android beta APK
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64   # or java-17 if 21 missing
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
./scripts/build-publish-beta-apk.sh   # or: cd apps/android && ./gradlew assembleBeta
```

Fill manifest `apk_sha256` / `size_bytes` from the built APK if the script does not rewrite them.

---

## 4. Publish (ops-dev-01)

### 4.1 Play

```bash
SRC=apps/debug-client/dist
DEST=/var/www/akalynth-beta/play
TS=$(date -u +%Y%m%dT%H%M%SZ)
cp -a "$DEST" "${DEST}.bak-pre-${TS}"
rsync -a --delete "$SRC/" "$DEST/"
# match host freeze style if required
find "$DEST" -type d -exec chmod 555 {} \;
find "$DEST" -type f -exec chmod 444 {} \;
```

Verify:

```bash
curl -sfS https://beta.akalynth.com/play/ | grep -oE 'assets/index-[^"]+\.js'
# JS must not contain dpad-stop; should retain play chrome
```

### 4.2 APK + manifest

```bash
CODE=2026080702   # example
APK=apps/android/app/build/outputs/apk/beta/app-beta.apk
NAME=akalynth-beta-v${CODE}.apk
sha256sum "$APK"
cp -a "$APK" /var/www/akalynth-beta/download/"$NAME"
echo "$(sha256sum "$APK" | awk '{print $1}')  $NAME" > /var/www/akalynth-beta/download/"$NAME".sha256

# repo manifest must already match CODE/NAME/sha
install -m 644 infra/android/beta-client-update.json \
  /opt/akalynth-beta/infra/android/beta-client-update.json

# reload API process that caches the JSON
kubectl -n akalynth-lanes rollout restart deploy/akalynth-game-beta
kubectl -n akalynth-lanes rollout status deploy/akalynth-game-beta --timeout=180s
```

Verify:

```bash
curl -sfS 'https://beta-api.akalynth.com/v1/client/android-update?lane=beta' | jq .
curl -sSI "https://beta.akalynth.com/download/$NAME" | head
curl -sfS "https://beta.akalynth.com/download/$NAME" | sha256sum
```

---

## 5. Evidence

Write a dated receipt under `evidence/` or `akalynth-ops/evidence/` with:

- monorepo SHA
- play asset basenames
- APK version_code / sha256 / size
- health commit (server)
- android-update JSON snapshot

---

## 6. Failure modes

| Failure | Action |
|---------|--------|
| versionCode ≤ live | Bump and rebuild; do not force-overwrite with lower code |
| SHA mismatch on download | Re-copy APK; re-check Caddy root |
| API still shows old code | Confirm env path, rewrite `/opt/.../beta-client-update.json`, restart pod |
| Play still has `dpad-stop` | Wrong dist / CDN cache; confirm `index.html` hashes and hard-refresh |
| Built from non-main branch | Back-merge to main same day or do not claim main is live |

---

## 7. Historical note (2026-08-07)

Live beta briefly shipped from `agent/ui-chrome-art-perf-lane` + deploy cherry-picks while `main` still had `versionCode = 10`.  
The unify PR merges that ladder into `main` so **the next ship is main-first**.
