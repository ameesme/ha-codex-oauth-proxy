// The openai-oauth CLI is interactive (keypress to detach/quit) and manages a runtime
// lock plus a forked child over an IPC channel. Calling the exported server directly
// gives a plain foreground process that s6 can supervise.
import { startOpenAIOAuthServer } from "openai-oauth";

const LEVELS = { debug: 10, info: 20, warning: 30, error: 40 };

const readEnv = (name, fallback = "") => (process.env[name] ?? "").trim() || fallback;

const threshold = LEVELS[readEnv("PROXY_LOG_LEVEL", "info")] ?? LEVELS.info;

const log = (level, message) => {
  if (LEVELS[level] >= threshold) {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
};

const requestLogger = (event) => {
  if (event.type === "chat_request") {
    log(
      "debug",
      `${event.requestId} -> ${event.model ?? "?"} messages=${event.messageCount} tools=${event.toolCount} stream=${event.stream}`,
    );
  } else if (event.type === "chat_response") {
    log(
      "info",
      `${event.requestId} <- ${event.status} in ${event.durationMs}ms (in=${event.usage.inputTokens ?? 0} out=${event.usage.outputTokens ?? 0})`,
    );
  } else {
    log("error", `${event.requestId} failed after ${event.durationMs}ms: ${event.message}`);
  }
};

const models = readEnv("PROXY_MODELS")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

const codexVersion = readEnv("PROXY_CODEX_VERSION");

const settings = {
  host: readEnv("PROXY_HOST", "127.0.0.1"),
  port: Number(readEnv("PROXY_PORT", "10532")),
  authFilePath: readEnv("PROXY_AUTH_FILE", "/data/auth.json"),
  requestLogger,
  ...(models.length > 0 ? { models } : {}),
  ...(codexVersion ? { codexVersion } : {}),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// startOpenAIOAuthServer resolves the model list before it binds, so a cold boot that
// beats the network up, or a transient Codex outage, throws instead of listening.
const start = async () => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await startOpenAIOAuthServer(settings);
    } catch (error) {
      const delay = Math.min(30_000, 2_000 * attempt);
      const reason = error instanceof Error ? error.message : String(error);
      log("error", `Startup attempt ${attempt} failed: ${reason} Retrying in ${delay / 1000}s.`);
      await sleep(delay);
    }
  }
};

const server = await start();

log("info", `Upstream proxy listening on ${server.url}`);
log("info", `Models: ${server.models.join(", ") || "none reported"}`);

const shutdown = () => {
  server.close().finally(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
