import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";

let _client: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(dbPath?: string) {
  if (_client) return _client;

  const path = dbPath ?? process.env.DATABASE_PATH ?? "./data/northstar-ledger.db";
  const sqlite = new Database(path);

  // 启用 WAL 模式以获得更好的并发读取性能
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _client = drizzle(sqlite, { schema, logger: process.env.NODE_ENV === "development" });
  return _client;
}

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}
