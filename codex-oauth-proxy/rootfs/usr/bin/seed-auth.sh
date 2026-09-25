#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

readonly AUTH_FILE="/data/auth.json"
readonly SEED_HASH_FILE="/data/.auth_seed_hash"

fatal() {
    bashio::log.fatal "$1"
    exec /run/s6/basedir/bin/halt
}

if bashio::config.has_value 'auth_json'; then
    seed="$(bashio::config 'auth_json')"

    if ! jq -e 'type == "object"' >/dev/null 2>&1 <<<"${seed}"; then
        fatal "Option 'auth_json' is not a JSON object. Paste the full contents of ~/.codex/auth.json."
    fi

    if ! jq -e '.tokens.refresh_token | strings | length > 0' >/dev/null 2>&1 <<<"${seed}"; then
        fatal "Option 'auth_json' has no .tokens.refresh_token. Run 'codex login' locally and copy the resulting auth.json."
    fi

    seed_hash="$(printf '%s' "${seed}" | sha256sum | cut -d' ' -f1)"
    stored_hash="$(cat "${SEED_HASH_FILE}" 2>/dev/null || true)"

    # /data is the source of truth: openai-oauth rewrites auth.json on every token
    # refresh and OpenAI rotates refresh tokens, so re-seeding an unchanged option
    # would overwrite valid rotated tokens with the stale pasted blob.
    if [[ -f "${AUTH_FILE}" && "${stored_hash}" == "${seed_hash}" ]]; then
        bashio::log.info "Keeping existing ${AUTH_FILE}; the 'auth_json' option has not changed."
    else
        printf '%s' "${seed}" >"${AUTH_FILE}"
        chmod 600 "${AUTH_FILE}"
        printf '%s' "${seed_hash}" >"${SEED_HASH_FILE}"
        bashio::log.info "Seeded ${AUTH_FILE} from the 'auth_json' option."
    fi
fi

if [[ ! -f "${AUTH_FILE}" ]]; then
    fatal "No credentials found. Paste the contents of ~/.codex/auth.json into the 'auth_json' option and restart."
fi

chmod 600 "${AUTH_FILE}"
