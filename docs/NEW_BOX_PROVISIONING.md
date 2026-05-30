# New Box Provisioning Runbook

Provisioning + deploy runbook for the two Amsterdam VPSes. This is an
operations note. It does not claim production readiness; it describes the
steps to bring the boxes up to the repo's deploy conventions.

Governed by the `deploy-steward` conventions: SSH as `sovereign`, UFW allows
`22/80/443` before enable, preserve `/var/lib/akalynth` and `/etc/akalynth`,
and **stop before** changing DNS, disabling root SSH, or opening new ports —
those are gated manual steps below.

## Host Roles

| Role | Host | Spec | IPv4 | IPv6 |
|------|------|------|------|------|
| **PROD** (Node server + Caddy, internet-facing) | XEON-AMS1 | 4 GB / 2c / 40 GB | `194.147.221.85` | `2a12:9080:0:54::/64` |
| **DEV + Android builds** (SSH-only) | XEON-AMS1 | 16 GB / 8c / 160 GB | `194.147.221.89` | `2a12:9080:0:58::/64` |

Pinned toolchain (from repo):

- Node **24** (NodeSource) on both boxes — `scripts/bootstrap_linux.sh` installs
  apt `nodejs`, which is too old; use NodeSource instead.
- Android: AGP **8.7.3** / Kotlin **2.0.21** / Gradle **8.9** (wrapper) /
  **JDK 17** / compileSdk + build-tools **35** / minSdk 26.

---

## Box A — PROD (`194.147.221.85`)

Fresh genesis: a brand-new auth keypair and empty receipt chain. This publishes
a new `auth_public_key_hex` at `/v1/transparency`.

### A1. Base + users + Node 24

```bash
# as root
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl git build-essential gnupg

# Node 24 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
node -v && npm -v   # expect v24.x

# Service account (non-login) for the server
useradd --system --home /var/lib/akalynth --shell /usr/sbin/nologin akalynth || true
```

### A2. Firewall (confirm SSH still works before/after)

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw status verbose          # confirm 22/80/443 present BEFORE enabling
ufw enable
```

### A3. Repo + runtime paths

```bash
# Repo is PRIVATE — authenticate first (one of):
#   gh auth login && gh auth setup-git          # gh as HTTPS credential helper
#   or add a read-only deploy key to the repo and clone via git@github.com
git clone https://github.com/VaultSovereign/akalynth.git /opt/akalynth
cd /opt/akalynth && git checkout main

# Runtime data + secrets (owned by akalynth, NOT in the repo)
install -d -o akalynth -g akalynth -m 0750 /var/lib/akalynth/audit /var/lib/akalynth/data
install -d -o akalynth -g akalynth -m 0750 /etc/akalynth
```

### A4. Build

```bash
cd /opt/akalynth
npm ci --ignore-scripts
npm rebuild better-sqlite3
node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')"
npm run build:packages
npm -w apps/server run build
test -f /opt/akalynth/dist/server/apps/server/src/index.js && echo "build OK"
```

### A5. Genesis (one-time) — creates the auth keypair + chronicle key

Run **once**, as the `akalynth` user, with the systemd env so paths match the
unit. This writes `/etc/akalynth/chronicle.key` and seeds the empty chain.

```bash
sudo -u akalynth env \
  HOME=/var/lib/akalynth \
  AKALYNTH_BOOTSTRAP=1 \
  AKALYNTH_RECEIPT_CHAIN_PATH=/var/lib/akalynth/audit/receipts.jsonl \
  AKALYNTH_DB_PATH=/var/lib/akalynth/data/akalynth.db \
  CHRONICLE_KEY_PATH=/etc/akalynth/chronicle.key \
  node /opt/akalynth/dist/server/apps/server/src/index.js --bootstrap-only 2>&1 | tail -20
# Confirm the key now exists, locked down:
chmod 0400 /etc/akalynth/chronicle.key && chown akalynth:akalynth /etc/akalynth/chronicle.key
ls -l /etc/akalynth/chronicle.key
```

> If the server has no `--bootstrap-only` flag, start the service once with
> `AKALYNTH_BOOTSTRAP=1` set in a drop-in, confirm the key is written, then
> remove the bootstrap env and restart. **Never** re-bootstrap after genesis —
> it mints a new identity and breaks the receipt chain.

### A6. systemd

```bash
install -m 0644 /opt/akalynth/infra/systemd/akalynth.service /etc/systemd/system/akalynth.service
systemctl daemon-reload
systemctl enable --now akalynth
systemctl is-enabled akalynth && systemctl is-active akalynth
journalctl -u akalynth --no-pager -n 80
curl -sf http://127.0.0.1:3000/v1/health     # expect {"ok":true,...}
```

### A7. Caddy (reverse proxy + TLS)

```bash
apt-get install -y caddy
install -d -m 0755 /var/log/caddy
install -m 0644 /opt/akalynth/infra/caddy/Caddyfile.example /etc/caddy/Caddyfile
# edit if the domain differs, then:
systemctl reload caddy
systemctl status caddy --no-pager | head -10
```

### A8. DNS cutover — GATED, manual

Do **not** repoint DNS until A6 local health is green.

1. Confirm `curl -sf http://127.0.0.1:3000/v1/health` → `"ok":true`.
2. In Cloudflare, point `api.akalynth.com` → `194.147.221.85`, mode
   **Full (strict)**.
3. Verify external: `curl -i https://api.akalynth.com/v1/health` → `200`.
4. Verify identity is non-empty:
   `curl -s https://api.akalynth.com/v1/transparency | grep auth_public_key_hex`
   (must not be `""`).

### A9. Routine deploys

```bash
cd /opt/akalynth && ./infra/deploy_beta.sh main
```

### Rollback (PROD)

- Bad deploy: `cd /opt/akalynth && git checkout <last-good-sha> && ./infra/deploy_beta.sh <last-good-sha>`.
- Service won't start: `journalctl -u akalynth --no-pager -n 120`; revert unit
  with the previous `/etc/systemd/system/akalynth.service`; `systemctl daemon-reload && systemctl restart akalynth`.
- Never delete `/var/lib/akalynth` or `/etc/akalynth/chronicle.key`.
- DNS rollback: repoint `api.akalynth.com` back to the prior host.

---

## Box B — DEV + Android builds (`194.147.221.89`)

SSH-only. Never serves players; no inbound 80/443 needed.

### B1. Base + Node 24 + JDK 17

```bash
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl git build-essential gnupg unzip
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
apt-get install -y temurin-17-jdk || apt-get install -y openjdk-17-jdk
java -version   # expect 17.x (NOT 25 — AGP 8.7.3 needs 17/21)

ufw allow 22/tcp && ufw status verbose && ufw enable
```

### B2. Android SDK (cmdline-tools + platform 35)

```bash
# as the dev user (e.g. sovereign)
export ANDROID_HOME="$HOME/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd "$ANDROID_HOME/cmdline-tools"
curl -fsSLo cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q cmdtools.zip && mv cmdline-tools latest && rm cmdtools.zip
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

# Persist for future shells
echo 'export ANDROID_HOME="$HOME/android-sdk"' >> ~/.bashrc
echo 'export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"' >> ~/.bashrc
```

### B3. Clone + build

```bash
# Private repo — authenticate first (gh auth setup-git, or a deploy key)
git clone https://github.com/VaultSovereign/akalynth.git ~/akalynth
cd ~/akalynth
npm install
npm run build

# Android APK (Gradle wrapper pulls 8.9 itself)
cd apps/android
JAVA_HOME=/usr/lib/jvm/temurin-17-jdk-amd64 ./gradlew assembleDebug
ls -l app/build/outputs/apk/debug/app-debug.apk
```

This is the box where the `EncryptedSharedPreferences` token-at-rest migration
(audit finding #3) can finally be built and verified.

---

## Verification checklist (after both boxes are up)

- [ ] PROD: `systemctl is-active akalynth` → `active`
- [ ] PROD: `curl -sf http://127.0.0.1:3000/v1/health` → `"ok":true`
- [ ] PROD: `ufw status verbose` shows only `22/80/443`
- [ ] PROD: `ss -tulpn` shows Node bound to `127.0.0.1:3000` only (not `0.0.0.0`)
- [ ] PROD (post-cutover): `curl -i https://api.akalynth.com/v1/health` → `200`
- [ ] PROD (post-cutover): `/v1/transparency` `auth_public_key_hex` is non-empty
- [ ] DEV: `./gradlew assembleDebug` produces `app-debug.apk`
- [ ] DEV: `ufw status verbose` shows only `22`
