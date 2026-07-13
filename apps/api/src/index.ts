import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pino from "pino";
import { accountsRoutes } from "./routes/accounts.js";
import { customersRoutes } from "./routes/customers.js";
import { importRoutes } from "./routes/imports.js";
import { integrityRoutes } from "./routes/integrity.js";
import { invoicesRoutes } from "./routes/invoices.js";
import { projectsRoutes } from "./routes/projects.js";
import { summaryRoutes } from "./routes/summary.js";
import { transactionsRoutes } from "./routes/transactions.js";

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

// ── API v1 Routes ──

const api = new Hono();

api.get("/", (c) => c.json({ message: "Northstar Ledger API v1" }));

api.route("/accounts", accountsRoutes);
api.route("/customers", customersRoutes);
api.route("/projects", projectsRoutes);
api.route("/transactions", transactionsRoutes);
api.route("/summary", summaryRoutes);
api.route("/import", importRoutes);
api.route("/integrity", integrityRoutes);
api.route("/invoices", invoicesRoutes);

app.route("/api/v1", api);

// ── Global Error Handler ──

app.onError((err, c) => {
  log.error({ err }, "Unhandled error");
  return c.json(
    {
      error: "Internal server error",
      message: process.env.NODE_ENV !== "production" ? err.message : undefined,
    },
    500,
  );
});

// ── Startup ──

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";

log.info({ port, host }, "API server starting");

export default {
  port,
  host,
  fetch: app.fetch,
};
