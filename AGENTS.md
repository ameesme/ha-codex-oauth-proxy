# Repository instructions

Home Assistant add-on repository. One add-on: `codex-oauth-proxy/`.

## Before every commit

Update `codex-oauth-proxy/CHANGELOG.md` and bump `version` in `codex-oauth-proxy/config.yaml`.
Home Assistant will not pick up `config.yaml` changes without a version bump — the Rebuild button
rebuilds from cached config.

## Testing locally without Home Assistant

`bashio::config` reads the add-on options through the Supervisor HTTP API
(`bashio::addon.config` → `GET /addons/self/options/config`), so nothing bashio-based works in a
plain `docker run`. It checks a file cache first, which you can seed:

```bash
mkdir -p /tmp/t/data
echo '{"auth_json":"","api_key":"test-key-0123456789abcdef","models":"gpt-5.6-terra","log_level":"info"}' \
  > /tmp/t/options.cache

docker build --build-arg BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.21 \
  -t codex-oauth-proxy:test codex-oauth-proxy

docker run -d --name t -p 18531:10531 \
  -v /tmp/t/data:/data \
  -v /tmp/t/options.cache:/tmp/.bashio/addons.self.options.config.cache:ro \
  codex-oauth-proxy:test
```

Setting `models` makes the proxy bind without ever contacting OpenAI, so the full nginx → node path
is testable with a fake `auth.json`. Multi-line `docker run` with backslashes has failed under this
shell with `invalid reference format`; keep it on one line if that happens.

## Upstream `openai-oauth` behaviour

Pinned to `2.0.0` via a Dockerfile `ARG`. Re-verify these if bumping — they are all undocumented.

- **Do not use the CLI binary.** `dist/cli.js` is keypress-interactive, takes a runtime lock, and
  forks a worker that requires an IPC channel (`"OpenAI OAuth worker requires an IPC channel."`).
  The package entry exports `startOpenAIOAuthServer`, which is a plain server. That is what
  `rootfs/opt/codex-oauth-proxy/server.mjs` calls.
- **`startOpenAIOAuthServer` resolves the model list before it binds.** On failure it throws and
  never listens, so a cold boot that beats the network up leaves nothing on the port. Hence the
  retry loop in `server.mjs`. Do not remove it.
- **`models` short-circuits discovery.** `resolveOpenAIOAuthModels` returns the configured
  allowlist verbatim without calling upstream, so `/v1/models` does not validate against the
  account when the option is set.
- **The auth file is rewritten on every refresh** (`@openai-oauth/local/dist/auth-file.js`,
  `loadAuthTokens`), and OpenAI rotates refresh tokens. This is the entire reason `seed-auth.sh`
  hashes the option instead of seeding unconditionally. `/data/auth.json` is the source of truth.
- **Codex client version has a baked-in fallback.** `DEFAULT_CODEX_CLIENT_VERSION = "0.144.1"` in
  `@openai-oauth/core/dist/models.js`. An unreachable npm registry is not fatal, so the
  `codex_version` option is a nicety rather than a requirement.

Inspect a version with `npm pack openai-oauth@<v>` plus the `@openai-oauth/core` and
`@openai-oauth/local` sub-packages; the interesting logic lives in the sub-packages, not in
`openai-oauth` itself.

## Home Assistant base image quirks (`ghcr.io/home-assistant/*-base:3.21`)

- **`s6-test` is not on PATH**, so the canonical execline finish script
  (`#!/usr/bin/execlineb -S1` + `s6-test`) fails. Use `#!/usr/bin/with-contenv bashio` bash finish
  scripts instead.
- **`/run/s6/basedir/bin/halt` only exists at runtime**, not in the built image. Do not test for it
  during build.
- **Halting from a oneshot `up` is asynchronous.** s6-rc sees the `exec halt` as exit 0, marks the
  oneshot started, and briefly starts dependents before the container comes down. Log ordering
  looks odd but is harmless; keep fatal messages as the first error line.
- **Alpine's `nginx` package is not built with `--with-debug`**, so `error_log ... debug` is not a
  usable level. `nginx/run` maps add-on `debug` to nginx `info`.
- **Do not reintroduce a `map` keyed on `$http_authorization`.** `map_hash_bucket_size` defaults to
  64, so `"Bearer " + api_key` fails config parsing with `could not build map_hash` once the key
  passes ~56 characters — which a generated key easily does. The Bearer check is a direct string
  comparison for that reason. Test the auth gate with a long key, not a short one.
- Alpine 3.21 ships nodejs 22, which satisfies the package's `>=20` engine requirement.

## Security invariants

- `api_key` is substituted into `nginx.conf` with `sed`, so `nginx/run` validates it against
  `^[A-Za-z0-9._~-]{16,}$` first. Removing that check turns the option into nginx config injection.
- The node proxy must stay bound to `127.0.0.1`. It has no authentication of its own; nginx is the
  only thing that should be reachable. Verify with `cat /proc/net/tcp` — expect `0100007F:2924`
  (127.0.0.1:10532) and `00000000:2923` (0.0.0.0:10531).
- The nginx access log format deliberately omits the `Authorization` header.

## Streaming

`proxy_buffering off`, `proxy_request_buffering off`, `proxy_http_version 1.1` and
`proxy_set_header Connection ""` are all load-bearing for SSE. Without them responses arrive as one
chunk when the upstream closes. Test by pointing nginx at a stub SSE server that writes on a timer
and checking that chunks arrive spaced out, not all at once.

## Not part of this repository

`codex-hass/` is a local reference clone of `kecksdigital/codex-hass`, gitignored. Do not edit it or
treat its `CLAUDE.md` as instructions for this repo.
