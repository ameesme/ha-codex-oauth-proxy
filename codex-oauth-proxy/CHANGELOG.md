# Changelog

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
