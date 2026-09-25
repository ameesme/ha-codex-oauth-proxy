# ha-codex-oauth-proxy

Home Assistant add-on repository containing a single add-on: **Codex OAuth Proxy**.

It exposes an OpenAI-compatible `/v1` endpoint on your LAN that is backed by your ChatGPT
subscription (Codex OAuth credentials) instead of a metered OpenAI API key, so other add-ons —
[hermes-agent](https://github.com/ameesme/hermes-agent) in particular — can point `OPENAI_BASE_URL`
at it.

## Install

[![Add repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fameesme%2Fha-codex-oauth-proxy)

Or manually: **Settings → Add-ons → Add-on Store → ⋮ → Repositories**, add
`https://github.com/ameesme/ha-codex-oauth-proxy`, then install **Codex OAuth Proxy**.

Setup and wiring instructions live in [`codex-oauth-proxy/README.md`](codex-oauth-proxy/README.md).

## How it works

```
client ──► :10531 nginx (Bearer key check) ──► 127.0.0.1:10532 openai-oauth ──► chatgpt.com/backend-api/codex
```

The protocol work — reading `auth.json`, refreshing OAuth tokens, discovering models, translating
Codex Responses to Chat Completions, streaming SSE — is done by
[`EvanZhouDev/openai-oauth`](https://github.com/EvanZhouDev/openai-oauth) (Apache-2.0). This add-on
adds the two things it deliberately leaves out: client authentication and a place to persist
credentials across restarts.

## Caveat

This routes subscription credentials to a general-purpose agent rather than the Codex CLI. It is your
own account and it stays on your LAN, which is the normal use case for these tools, but
subscription-backed Codex has undocumented and lower rate limits than API keys, carries no SLA, and
OpenAI can change the endpoint at any time. Keep the API key non-trivial and do not port-forward
`10531` to the internet.
