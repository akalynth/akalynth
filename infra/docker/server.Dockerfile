# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS build

WORKDIR /app
ENV npm_config_update_notifier=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && npm run build:packages \
  && npm -w apps/server run build \
  && cp apps/server/package.json dist/server/package.json \
  && cp apps/server/package.json dist/server/apps/server/package.json \
  && test -f dist/server/apps/server/src/index.js

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
  AKALYNTH_ENV=production \
  PORT=3000 \
  HOST=0.0.0.0 \
  REQUIRE_TLS=1 \
  TRUST_PROXY=1 \
  TRUST_PROXY_LOOPBACK_ONLY=1 \
  ALLOW_INSECURE_LOCAL=0 \
  AKALYNTH_RECEIPT_CHAIN_PATH=/var/lib/akalynth/audit/receipts.jsonl \
  AKALYNTH_DB_PATH=/var/lib/akalynth/data/akalynth.db \
  AKALYNTH_REPLAY_MARKER_PATH=/var/lib/akalynth/data/replay_marker.json \
  CHRONICLE_KEY_PATH=/run/secrets/chronicle.key

RUN groupadd --system --gid 10001 akalynth \
  && useradd --system --uid 10001 --gid akalynth --home-dir /var/lib/akalynth --shell /usr/sbin/nologin akalynth \
  && mkdir -p /app /var/lib/akalynth/data /var/lib/akalynth/audit /run/secrets \
  && chown -R akalynth:akalynth /app /var/lib/akalynth

WORKDIR /app/apps/server
COPY --from=build --chown=akalynth:akalynth /app /app
COPY infra/docker/akalynth-container-entrypoint /usr/local/bin/akalynth-container-entrypoint
RUN chmod 0755 /usr/local/bin/akalynth-container-entrypoint

EXPOSE 3000
VOLUME ["/var/lib/akalynth"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s CMD node -e "const http=require('node:http');const port=Number(process.env.PORT||3000);const req=http.get({host:'127.0.0.1',port,path:'/v1/health',headers:{'x-forwarded-proto':'https'}},res=>{res.resume();process.exit(res.statusCode===200?0:1);});req.on('error',()=>process.exit(1));req.setTimeout(4000,()=>{req.destroy();process.exit(1);});"

ENTRYPOINT ["/usr/local/bin/akalynth-container-entrypoint"]
CMD ["node", "../../dist/server/apps/server/src/index.js"]
