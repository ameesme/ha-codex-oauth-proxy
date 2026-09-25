# Changelog

## [0.1.0] - 2026-09-15

### Added

- Initial release: OpenAI-compatible `/v1` endpoint on port `10531` backed by ChatGPT
  subscription credentials, wrapping `openai-oauth@2.0.0`.
- nginx Bearer token gate in front of the loopback-bound proxy, with SSE streaming passed
  through unbuffered.
- Hash-based seeding of `/data/auth.json` from the `auth_json` option, so rotated refresh
  tokens written back by the proxy survive restarts.
- Options for a model allowlist, a pinned Codex client version, and log level.
