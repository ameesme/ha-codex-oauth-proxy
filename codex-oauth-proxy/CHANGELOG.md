# Changelog

## [0.1.3] - 2026-09-28

### Added

- `trace: true` writes every inbound request body to `/share/codex-oauth-proxy/trace.jsonl`
  as one JSON object per line, with the body nested as a JSON string. That captures the
  system prompt, the tool schemas and the full message history, so an agent loop can be
  replayed exactly. Assistant turns are included too, because each request carries the
  previous ones. Off by default: the file contains whatever the client sent, prompts and
  all, and `/share` is readable by every add-on that maps it.

## [0.1.2] - 2026-09-28

### Added

- `log_level: debug` now logs the full token breakdown per response, including reasoning
  and cached input tokens.

### Changed

- `/v1/models` no longer requires the Bearer key, so a client can list models before it has
  one configured. Every other endpoint, inference included, still requires it.
- Dropped source maps, type declarations and the unused `openai-oauth` CLI (with its
  `yargs` dependency) from the image, cutting `node_modules` from 31 MB to 21 MB.

### Fixed

- `reasoningEffort` was silently dropped for the `gpt-6` models, so they ran without
  reasoning. `@openai-oauth/ai-sdk` hard-pins `@ai-sdk/openai` 3.0.41, which predates
  that family; an npm override now installs 3.0.119.

## [0.1.1] - 2026-09-25

### Fixed

- nginx failed to start with `could not build map_hash` when `api_key` was longer than
  about 56 characters. The Bearer check is now a direct string comparison instead of a
  `map`, which removes the key length ceiling entirely.

## [0.1.0] - 2026-09-15

### Added

- Initial release: OpenAI-compatible `/v1` endpoint on port `10531` backed by ChatGPT
  subscription credentials, wrapping `openai-oauth@2.0.0`.
- nginx Bearer token gate in front of the loopback-bound proxy, with SSE streaming passed
  through unbuffered.
- Hash-based seeding of `/data/auth.json` from the `auth_json` option, so rotated refresh
  tokens written back by the proxy survive restarts.
- Options for a model allowlist, a pinned Codex client version, and log level.
