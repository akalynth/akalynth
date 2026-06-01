# Akalynth Box Provisioning Runbook

Provisioning two Amsterdam VPSes into distinct roles. This is an operations
runbook, not a release claim. Run steps as the operator over SSH; nothing here
is auto-executed by CI.

| Role | Host | IPv4 | Specs |
|------|------|------|-------|
| **PROD** (game server + Caddy, internet-facing) | XEON-AMS1 | `194.147.221.85` | 4 GB / 2c / 40 GB |
| **DEV + Android builds** (SSH-only) | XEON-AMS1 | `194.147.221.89` | 16 GB / 8c / 160 GB |

Pinned versions (from the repo, do not drift):

- Node **24** (NodeSource — *not* the distro `nodejs`, which is too old).
- Android: AGP **8.7.3**, Kotlin **2.0.21**, Gradle **8.9** (wrapper), **JDK 17**,
  `compileSdk`/`targetSdk` **35**, `build-tools;35.0.0`, `minSdk` 26.

Deploy-steward guardrails (apply throughout):

- SSH as `sovereign`; confirm that login works **before** any SSH hardening.
- UFW must allow `22`, `80`, `443` **before** `ufw enable`.
- Never overwrite `/etc/akalynth/chronicle.key` or delete `/var/lib/akalynth`.
- DNS cutover and opening new ports are explicit, gated, manual steps.

---

## Box A — PROD (`194.147.221.85`)

Runs only the Node game server behind Caddy. The server binds loopback
(`HOST=127.0.0.1` in `infra/systemd/akalynth.service`); only Caddy is public.
**Fresh genesis** — a new auth keypair and empty receipt chain (confirmed
decision; do not migrate old prod state).

### A1. Base + firewall

```bash
# as root
adduser --system --group --home /var/lib/akalynth --shell /usr/sbin/nologin akalynth
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl git build-essential ufw

# Firewall: allow before enabling (deploy-steward rule)
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw status verbose          # confirm 22/80/443 present
ufw enable                  # only after confirming SSH (22) is allowed
```

### A2. Node 24 (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
node -v && npm -v           # expect v24.x
```

### A3. Repo + runtime paths

```bash
git clone https://github.com/VaultSovereign/akalynth.git /opt/akalynth
install -d -o akalynth -g akalynth -m 0750 /var/lib/akalynth/audit /var/lib/akalynth/data
install -d -o akalynth -g akalynth -m 0750 /etc/akalynth
```

The chronicle key is created by genesis in A5 — do not pre-place or overwrite it.

### A4. systemd unit

```bash
cp /opt/akalynth/infra/systemd/akalynth.service /etc/systemd/system/akalynth.service
systemctl daemon-reload
# Do NOT start yet — first start is genesis (A5).
```

The repo unit is already hardened (UMask=027, NoNewPrivileges, PrivateTmp,
ProtectSystem=full, RestrictNamespaces, …). Installing it fresh here resolves
the stale-unit finding from the audit. Optional hardening bump for review:
`ProtectSystem=full` → `strict`.

### A5. First build + genesis

```bash
cd /opt/akalynth
sudo -u akalynth npm ci --ignore-scripts
sudo -u akalynth npm rebuild better-sqlite3
sudo -u akalynth npm run build:packages
sudo -u akalynth npm -w apps/server run build

# One-time genesis: generates the Ed25519 auth keypair + chronicle key.
# This is what makes /v1/transparency serve a non-empty auth_public_key_hex.
sudo -u akalynth AKALYNTH_BOOTSTRAP=1 \
  CHRONICLE_KEY_PATH=/etc/akalynth/chronicle.key \
  node /opt/akalynth/dist/server/apps/server/src/index.js   # Ctrl-C after genesis logs the key
chmod 0400 /etc/akalynth/chronicle.key && chown akalynth:akalynth /etc/akalynth/chronicle.key
```

> After genesis, `AKALYNTH_BOOTSTRAP` must be **0/unset** for all normal starts
> (the systemd unit does not set it). Re-running bootstrap would re-genesis and
> break chain continuity.

### A6. Start service + local proof

```bash
systemctl enable --now akalynth
systemctl is-enabled akalynth && systemctl is-active akalynth
journalctl -u akalynth --no-pager -n 80
curl -sf http://127.0.0.1:3000/v1/health          # expect {"ok":true,...}
curl -sf http://127.0.0.1:3000/v1/transparency | grep -o '"auth_public_key_hex":"[^"]*"'  # must be NON-empty
```

### A7. Caddy reverse proxy

```bash
apt-get install -y caddy
install -d -o caddy -g caddy /var/log/caddy
cp /opt/akalynth/infra/caddy/Caddyfile.example /etc/caddy/Caddyfile
# (edit if the domain/log path differ)
systemctl reload caddy
systemctl status caddy --no-pager | head -10
```

### A8. DNS cutover — GATED, manual

> Do **not** repoint DNS until A6 returns 200 locally. This is the step that
> clears the production 502.

1. In Cloudflare, point `api.akalynth.com` → `194.147.221.85`.
2. Keep Cloudflare TLS mode **Full (strict)** (chain: Cloudflare → Caddy → Node).
3. Verify external health:
   ```bash
   curl -i https://api.akalynth.com/v1/health
   curl -s https://api.akalynth.com/v1/transparency | grep -o '"auth_public_key_hex":"[^"]*"'
   ```

### A9. Routine deploys

```bash
cd /opt/akalynth && ./infra/deploy_beta.sh main   # build, restart, health-check
```

### Rollback (PROD)

- Bad deploy: `cd /opt/akalynth && git checkout <last-good-sha> && ./infra/deploy_beta.sh <sha>`.
- Service won't start: `journalctl -u akalynth -n 200`; revert unit with the
  previous `/etc/systemd/system/akalynth.service`; `systemctl daemon-reload && systemctl restart akalynth`.
- DNS regression: repoint `api.akalynth.com` back to the prior host in Cloudflare.
- **Never** delete `/var/lib/akalynth` or `/etc/akalynth/chronicle.key` during rollback.

---

## Box B — DEV + Android builds (`194.147.221.89`)

SSH-only. Never serves players; no public ports beyond `22`.

### B1. Base + firewall

```bash
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl git build-essential unzip ufw
ufw allow 22/tcp && ufw status verbose && ufw enable
```

### B2. Node 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs && node -v && npm -v
```

### B3. JDK 17 (Temurin — not 25)

```bash
apt-get install -y temurin-17-jdk || apt-get install -y openjdk-17-jdk
java -version    # expect 17.x
```

### B4. Android SDK (command-line tools)

```bash
export ANDROID_HOME=/opt/android-sdk
install -d "$ANDROID_HOME"
cd /tmp && curl -fsSLo cmdtools.zip \
  https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q cmdtools.zip -d "$ANDROID_HOME/cmdline-tools"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
# Persist ANDROID_HOME + PATH in the build user's shell profile.
```

### B5. Build the repo + APK

```bash
git clone https://github.com/VaultSovereign/akalynth.git /opt/akalynth
cd /opt/akalynth && npm install && npm run build         # server + packages
cd apps/android && ./gradlew assembleDebug               # wrapper pulls Gradle 8.9
# Output: apps/android/app/build/outputs/apk/debug/app-debug.apk
```

This box is where the Android-side audit work (e.g. `EncryptedSharedPreferences`
token migration) can finally be built and verified — the prod box never gets the
SDK or build toolchain.

---

## Open follow-ups

- `scripts/bootstrap_linux.sh` installs distro `nodejs`/`npm` (too old). Patch it
  to install Node 24 via NodeSource so A2/B2 can call it directly.
- No Caddyfile previously existed in the repo; `infra/caddy/Caddyfile.example`
  added alongside this runbook.
