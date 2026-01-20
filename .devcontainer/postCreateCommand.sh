#!/usr/bin/env bash
# Devcontainer setup only — not part of v1 guarantees.
set -euo pipefail

echo "== Toolchain =="
node -v
npm -v
java -version

echo "== Build shared/server/debug-client (repo reality) =="

if [ -d "packages/shared" ]; then
  echo "-- packages/shared --"
  (cd packages/shared && npm ci && npm run typecheck)
else
  echo "SKIP: packages/shared not found"
fi

if [ -d "apps/server" ]; then
  echo "-- apps/server --"
  (cd apps/server && npm ci && npm run build)
else
  echo "SKIP: apps/server not found"
fi

if [ -d "apps/debug-client" ]; then
  echo "-- apps/debug-client --"
  (cd apps/debug-client && npm ci && npm run build)
else
  echo "SKIP: apps/debug-client not found"
fi

echo "== Android SDK bootstrap (only if Android app exists) =="

if [ -d "apps/android" ] && [ -f "apps/android/gradlew" ]; then
  SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
  mkdir -p "$SDK_ROOT/cmdline-tools"

  if [ ! -d "$SDK_ROOT/cmdline-tools/latest" ]; then
    echo "Downloading Android cmdline-tools..."
    cd /tmp
    curl -fsSL -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
    unzip -q cmdline-tools.zip
    mkdir -p "$SDK_ROOT/cmdline-tools/latest"
    mv cmdline-tools/* "$SDK_ROOT/cmdline-tools/latest/"
  fi

  yes | sdkmanager --licenses >/dev/null

  sdkmanager \
    "platform-tools" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "cmdline-tools;latest"

  echo "-- apps/android --"
  (cd apps/android && ./gradlew --version)
  (cd apps/android && ./gradlew assembleDebug)
else
  echo "SKIP: apps/android has no gradlew yet (placeholder only)."
fi

echo "Done."
