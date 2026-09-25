ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM ${BUILD_FROM}

# Pinned so a rebuild cannot silently pull a different proxy implementation.
ARG OPENAI_OAUTH_VERSION=2.0.0

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

RUN npm install \
        --prefix /opt/codex-oauth-proxy \
        --omit=dev --no-audit --no-fund \
        "openai-oauth@${OPENAI_OAUTH_VERSION}" \
    && npm cache clean --force \
    && rm -rf /root/.npm

COPY rootfs /

RUN chmod +x \
        /usr/bin/seed-auth.sh \
        /etc/s6-overlay/s6-rc.d/openai-oauth/run \
        /etc/s6-overlay/s6-rc.d/openai-oauth/finish \
        /etc/s6-overlay/s6-rc.d/nginx/run \
        /etc/s6-overlay/s6-rc.d/nginx/finish
