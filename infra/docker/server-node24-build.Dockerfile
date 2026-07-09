# syntax=docker/dockerfile:1.7
#
# Container build specification for schema25 target (b929b8d and future schema-25 sources).
# Pins Node 24.15.0 (per .nvmrc) with native build support for better-sqlite3.
# This is a build-only spec. Runtime image is separate.
#
# Usage (future apply lane):
#   docker build -f infra/docker/server-node24-build.Dockerfile -t akalynth/schema25-build:local .
#   # Then extract dist/ for staging and preflight.

FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app
ENV npm_config_update_notifier=false

# Native build deps for better-sqlite3 (python, make, g++)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     python3 \
     make \
     g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy source (lockfile-bound)
COPY . .

# Lockfile-bound install, ignore scripts during install, then rebuild native
RUN npm ci --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && npm run build:packages \
  && npm -w apps/server run build \
  && cp apps/server/package.json dist/server/package.json \
  && cp apps/server/package.json dist/server/apps/server/package.json \
  && test -f dist/server/apps/server/src/index.js

# Build stage produces /app/dist
# No runtime stage in this spec (build artifact only)
# Output: /app/dist (server build) + client if needed by full build
