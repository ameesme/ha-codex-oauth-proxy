ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM ${BUILD_FROM}

# Pinned so a rebuild cannot silently pull a different proxy implementation.
ARG OPENAI_OAUTH_VERSION=2.0.0

# @openai-oauth/ai-sdk hard-pins @ai-sdk/openai 3.0.41, which predates the gpt-6
# family and therefore drops reasoningEffort on those models.
ARG AI_SDK_OPENAI_VERSION=3.0.119

LABEL org.opencontainers.image.source="https://github.com/ameesme/ha-codex-oauth-proxy"

ENV LANG=C.UTF-8 \
    NODE_ENV=production

RUN apk add --no-cache \
        ca-certificates \
        jq \
        nginx \
        nodejs \
        npm \
    && update-ca-certificates

RUN mkdir -p /opt/codex-oauth-proxy \
    && printf '{"name":"codex-oauth-proxy","private":true,"overrides":{"@ai-sdk/openai":"%s"}}\n' \
        "${AI_SDK_OPENAI_VERSION}" >/opt/codex-oauth-proxy/package.json \
    && npm install \
        --prefix /opt/codex-oauth-proxy \
        --omit=dev --no-audit --no-fund \
        "openai-oauth@${OPENAI_OAUTH_VERSION}" \
    && npm cache clean --force \
    && rm -rf /root/.npm \
    && cd /opt/codex-oauth-proxy/node_modules \
    && rm -rf yargs yargs-parser openai-oauth/dist/cli.js \
    && find . \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \) -delete

COPY rootfs /

RUN chmod +x \
        /usr/bin/seed-auth.sh \
        /etc/s6-overlay/s6-rc.d/openai-oauth/run \
        /etc/s6-overlay/s6-rc.d/openai-oauth/finish \
        /etc/s6-overlay/s6-rc.d/nginx/run \
        /etc/s6-overlay/s6-rc.d/nginx/finish
