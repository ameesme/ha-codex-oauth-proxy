# Codex OAuth Proxy

Exposes an OpenAI-compatible `/v1` endpoint on your LAN that is backed by your ChatGPT
subscription (Codex OAuth credentials) rather than a metered OpenAI API key.

```
client ──► :10531 nginx (Bearer key check) ──► 127.0.0.1:10532 openai-oauth ──► chatgpt.com/backend-api/codex
```

The protocol work is done by [`EvanZhouDev/openai-oauth`](https://github.com/EvanZhouDev/openai-oauth)
(Apache-2.0). This add-on adds the two things it deliberately leaves out: client authentication and
credential persistence.

Endpoints passed through: `/v1/models`, `/v1/chat/completions`, `/v1/responses`,
`/v1/images/generations`, `/v1/images/edits`.

## Setup

### 1. Get your credentials

On a machine where you are already signed in to Codex, or after running `codex login`:

```bash
cat ~/.codex/auth.json
```

You need a file that contains `tokens.refresh_token`. If yours only has `OPENAI_API_KEY`, you are
signed in with an API key rather than your ChatGPT account and this add-on is not what you want.

### 2. Configure the add-on

| Option | Required | Description |
| --- | --- | --- |
| `auth_json` | on first start | Full contents of `~/.codex/auth.json`. |
| `api_key` | yes | The key clients must send as `Authorization: Bearer <key>`. At least 16 characters, only `A-Z a-z 0-9 . _ ~ -`. |
| `models` | no | Comma-separated allowlist, e.g. `gpt-5.6-terra,gpt-5.6-sol`. Empty means everything your account exposes. Setting this also removes a network call from cold start. |
| `codex_version` | no | Pin the Codex client version reported upstream, e.g. `0.144.1`. Empty resolves the latest from npm with a built-in fallback. |
| `log_level` | no | `debug` also logs one line per incoming request. |

Generate an API key with:

```bash
head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9'
```

The host port is remapped under **Configuration → Network**, not via an option. The container always
listens on `10531`.

### 3. Start it

The log should end with something like:

```
[INFO] Seeded /data/auth.json from the 'auth_json' option.
[INFO] Upstream proxy listening on http://127.0.0.1:10532/v1
[INFO] Models: gpt-5.6-sol, gpt-5.6-terra, gpt-image-2
[INFO] Starting nginx on port 10531...
```

## Token persistence

`openai-oauth` rewrites `auth.json` on every token refresh, and OpenAI rotates refresh tokens. So
`/data/auth.json` — not the `auth_json` option — is the source of truth once the add-on has started
successfully.

On each start the add-on hashes the `auth_json` option and compares it to `/data/.auth_seed_hash`. It
only rewrites `/data/auth.json` when the hash changed or the file is missing. Blindly re-seeding
would eventually clobber a valid rotated token with the stale pasted blob and break auth.

Practical consequence: **you can clear `auth_json` after the first successful start.** To force a
re-seed (for example after signing in again), paste the new `auth.json` — the changed hash triggers
the overwrite.

## Wiring hermes-agent

In the hermes add-on's `~/.hermes/.env`:

```bash
OPENAI_API_KEY=<the api_key from this add-on>
OPENAI_BASE_URL=http://<ha-host-ip>:10531/v1
```

Use provider `openai-api`.

Add-ons can also reach each other directly on the Supervisor network, which skips the host port hop.
The hostname is this add-on's full slug with underscores replaced by dashes — for a repository added
by URL that slug is prefixed with a repository hash, so read it off `docker ps` on the host (the
container is named `addon_<full-slug>`) rather than guessing it.

## Verification

```bash
KEY=<your api_key>
HOST=<ha-host-ip>

# Auth gate rejects unauthenticated calls
curl -si "http://$HOST:10531/v1/models" | head -1                  # HTTP/1.1 401 Unauthorized

# Model list
curl -s "http://$HOST:10531/v1/models" -H "Authorization: Bearer $KEY" | jq '.data[].id'

# Completion
curl -s "http://$HOST:10531/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"<id-from-above>","messages":[{"role":"user","content":"say hi"}]}' | jq .

# Streaming should arrive progressively, not in one burst at the end
curl -N -s "http://$HOST:10531/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"<id>","messages":[{"role":"user","content":"count to 20 slowly"}],"stream":true}'
```

Restart the add-on and re-run the completion to confirm `/data/auth.json` persisted.

Model IDs drift; always take them from `/v1/models` rather than assuming.

## Troubleshooting

**`No credentials found`** — `auth_json` is empty and `/data/auth.json` does not exist. Paste the
file contents into the option.

**`Option 'api_key' must be at least 16 characters`** — the key is substituted into `nginx.conf`, so
the charset is restricted to avoid config injection. Regenerate with the command above.

**`Startup attempt N failed`, repeating** — the proxy could not reach Codex or the tokens are dead.
If the message mentions the access token or account id, re-seed `auth_json`. If it is a network
error, it will recover on its own once connectivity is back.

**Responses arrive all at once instead of streaming** — something between the client and this add-on
is buffering; the add-on itself disables buffering end to end.

## Caveat

This routes subscription credentials to a general-purpose agent rather than the Codex CLI. It is your
own account and it stays on your LAN, which is the normal use case for these tools, but
subscription-backed Codex has undocumented and lower rate limits than API keys, carries no SLA, and
OpenAI can change the endpoint at any time. Keep the API key non-trivial and do not port-forward
`10531` to the internet.
