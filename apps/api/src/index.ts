import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pino from "pino";

const app = new Hono();

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

// Middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", version: "0.0.1" });
});

// ── Routes ──

const api = new Hono();

// 占位路由，后续逐步实现
api.get("/", (c) => c.json({ message: "Northstar Ledger API" }));

app.route("/api/v1", api);

// ── Startup ──

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";

log.info({ port, host }, "API server starting");

export default {
  port,
  host,
  fetch: app.fetch,
};
