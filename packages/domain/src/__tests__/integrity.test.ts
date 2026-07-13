import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { eq } from "drizzle-orm";

const TEST_DB = "./data/test-integrity.db";
process.env.DATABASE_PATH = TEST_DB;
process.env.LOG_LEVEL = "silent";

// Must import after setting env
import { accounts, getDb, resetDb } from "@northstar/db";
import { createAccount } from "../services/accounts.js";
import { previewTransactionImport } from "../services/imports.js";
import { checkAccountIntegrity, runIntegrityCheck } from "../services/integrity.js";
import { createTransaction } from "../services/transactions.js";

function initTestDb() {
  const sqlite = new Database(TEST_DB, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");

  sqlite.run(`CREATE TABLE IF NOT EXISTS accounts (
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

  sqlite.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  sqlite.run(`CREATE TABLE IF NOT EXISTS projects (
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

  sqlite.run(`CREATE TABLE IF NOT EXISTS transactions (
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

  sqlite.run(`CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    file_name TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    params TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    errors TEXT,
    summary TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  sqlite.close();
}

function cleanupTestDb() {
  for (const file of [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
}

beforeAll(() => {
  resetDb(); // 清除之前测试缓存的 DB 连接
  cleanupTestDb();
  initTestDb();
});

afterAll(() => {
  cleanupTestDb();
});

describe("Integrity Check", () => {
  it("passes for empty database", () => {
    const report = runIntegrityCheck();
    expect(report.totalIssues).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it("detects balance mismatch", () => {
    const acct = createAccount({ name: "测试账户", type: "bank", currency: "CNY" });

    createTransaction({
      accountId: acct.id,
      amount: 10000,
      type: "income",
      date: "2025-01-15",
      description: "测试收入",
    });

    // Manually set balance to wrong value to simulate corruption
    const db = getDb();
    db.update(accounts).set({ balance: 99999 }).where(eq(accounts.id, acct.id)).run();

    const report = runIntegrityCheck();
    expect(report.totalIssues).toBeGreaterThanOrEqual(1);
    const mismatch = report.issues.find((i) => i.category === "balance_mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch?.entityId).toBe(acct.id);
  });

  it("passes for consistent account", () => {
    const acct = createAccount({ name: "一致账户", type: "cash" });
    createTransaction({
      accountId: acct.id,
      amount: 5000,
      type: "income",
      date: "2025-02-01",
      description: "收入",
    });
    createTransaction({
      accountId: acct.id,
      amount: 2000,
      type: "expense",
      date: "2025-02-05",
      description: "支出",
    });

    const issues = checkAccountIntegrity(acct.id);
    expect(issues.length).toBe(0);
  });
});

describe("Import Duplicate Detection", () => {
  it("detects duplicate transactions in preview", () => {
    const acct = createAccount({ name: "导入重复测试", type: "bank" });
    createTransaction({
      accountId: acct.id,
      amount: 12345,
      type: "income",
      date: "2025-03-15",
      description: "咨询收入",
    });

    // Preview CSV with same transaction
    const csv =
      "date,amount,type,description\n2025-03-15,12345,income,咨询收入\n2025-03-16,54321,expense,办公费";
    const result = previewTransactionImport(csv, acct.id);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(1); // Only expense is new
    expect(result.duplicateRows).toBe(1); // Income is duplicate
  });
});
