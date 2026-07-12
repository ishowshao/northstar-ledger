import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema/index.js";

const dbPath = process.env["DATABASE_PATH"] ?? "./data/northstar-ledger.db";

// 先建库，设置 PRAGMA
const sqlite = new Database(dbPath, { create: true });
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

const db = drizzle({ client: sqlite, schema });

// 创建 accounts 表
db.run(`CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  currency TEXT NOT NULL DEFAULT 'CNY',
  balance INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

// 创建 customers 表
db.run(`CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

// 创建 projects 表
db.run(`CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  customer_id TEXT REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'active',
  hourly_rate INTEGER,
  currency TEXT DEFAULT 'CNY',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

// 创建 transactions 表
db.run(`CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  customer_id TEXT,
  project_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'cleared',
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  description TEXT,
  category TEXT,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

console.log(`✅ Database initialized at ${dbPath}`);
sqlite.close();
