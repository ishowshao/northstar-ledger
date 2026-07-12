import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema/index.js";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

let _client: BunSQLiteDatabase<typeof schema> | undefined;

export function getDb(dbPath?: string) {
  if (_client) return _client;

  const path = dbPath ?? process.env.DATABASE_PATH ?? "./data/northstar-ledger.db";

  _client = drizzle<typeof schema>({
    connection: { source: path, create: true },
    schema,
    logger: process.env.NODE_ENV === "development",
  }) as unknown as BunSQLiteDatabase<typeof schema>;

  // Enable WAL mode
  const sqlite = new Database(path);
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.close();

  return _client;
}

export function createTestDb() {
  return drizzle<typeof schema>({
    connection: { source: ":memory:" },
    schema,
  }) as unknown as BunSQLiteDatabase<typeof schema>;
}
