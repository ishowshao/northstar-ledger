import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";

// ── Test Database ──
// Must set before any handler calls getDb().
// Imports are hoisted in ESM, but getDb() is lazy — only called when a route runs.
// So setting the env var at the top level (after imports) is safe.

const TEST_DB = "./data/test-northstar-ledger.db";
process.env.DATABASE_PATH = TEST_DB;
process.env.LOG_LEVEL = "silent";

import server from "../index.js";

// ── Helpers ──

function req(path: string, init?: RequestInit) {
  return server.fetch(
    new Request(`http://localhost${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    }),
  );
}

// ── Setup / Teardown ──

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
  cleanupTestDb();
  initTestDb();
});

afterAll(() => {
  cleanupTestDb();
});

// ── Tests ──

describe("API Integration", () => {
  // ── Health ──

  describe("GET /health", () => {
    it("returns ok status", async () => {
      const res = await req("/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.version).toBe("0.0.1");
    });
  });

  // ── Accounts ──

  describe("Accounts CRUD", () => {
    let accountId: string;

    it("lists accounts (empty)", async () => {
      const res = await req("/api/v1/accounts");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });

    it("creates an account", async () => {
      const res = await req("/api/v1/accounts", {
        method: "POST",
        body: JSON.stringify({ name: "工商银行", type: "bank", currency: "CNY" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe("工商银行");
      expect(body.data.type).toBe("bank");
      expect(body.data.currency).toBe("CNY");
      expect(body.data.balance).toBe(0);
      expect(body.data.isActive).toBe(true);
      expect(body.data.id).toBeDefined();
      accountId = body.data.id;
    });

    it("gets account by id", async () => {
      const res = await req(`/api/v1/accounts/${accountId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(accountId);
      expect(body.data.name).toBe("工商银行");
    });

    it("returns 404 for non-existent account", async () => {
      const res = await req("/api/v1/accounts/00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
    });

    it("rejects account with empty name", async () => {
      const res = await req("/api/v1/accounts", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });
      expect(res.status).toBe(400);
    });

    it("lists accounts (non-empty)", async () => {
      const res = await req("/api/v1/accounts");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe("工商银行");
    });

    it("deletes account", async () => {
      const res = await req(`/api/v1/accounts/${accountId}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("returns 404 on deleted account", async () => {
      const res = await req(`/api/v1/accounts/${accountId}`);
      expect(res.status).toBe(404);
    });
  });

  // ── Customers ──

  describe("Customers CRUD", () => {
    let customerId: string;

    it("creates a customer", async () => {
      const res = await req("/api/v1/customers", {
        method: "POST",
        body: JSON.stringify({ name: "张三工作室", email: "zhang@example.com" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe("张三工作室");
      expect(body.data.email).toBe("zhang@example.com");
      customerId = body.data.id;
    });

    it("lists customers", async () => {
      const res = await req("/api/v1/customers");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe("张三工作室");
    });

    it("creates a second customer with minimal fields", async () => {
      const res = await req("/api/v1/customers", {
        method: "POST",
        body: JSON.stringify({ name: "李四" }),
      });
      expect(res.status).toBe(201);
      expect((await res.json()).data.name).toBe("李四");
    });

    it("deletes a customer", async () => {
      const res = await req(`/api/v1/customers/${customerId}`, { method: "DELETE" });
      expect(res.status).toBe(200);
    });
  });

  // ── Projects ──

  describe("Projects CRUD", () => {
    let customerId: string;
    let projectId: string;

    beforeAll(async () => {
      // Create a customer to reference
      const res = await req("/api/v1/customers", {
        method: "POST",
        body: JSON.stringify({ name: "测试客户" }),
      });
      customerId = (await res.json()).data.id;
    });

    it("creates a project with customer reference", async () => {
      const res = await req("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          name: "网站开发",
          customerId,
          status: "active",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe("网站开发");
      expect(body.data.customerId).toBe(customerId);
      expect(body.data.status).toBe("active");
      projectId = body.data.id;
    });

    it("lists projects", async () => {
      const res = await req("/api/v1/projects");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe("网站开发");
    });

    it("deletes project", async () => {
      const res = await req(`/api/v1/projects/${projectId}`, { method: "DELETE" });
      expect(res.status).toBe(200);
    });
  });

  // ── Transactions ──

  describe("Transactions", () => {
    let accountId: string;

    beforeAll(async () => {
      // Create an account for transactions
      const res = await req("/api/v1/accounts", {
        method: "POST",
        body: JSON.stringify({ name: "现金账户", type: "cash", currency: "CNY" }),
      });
      accountId = (await res.json()).data.id;
    });

    it("creates an income transaction and updates balance", async () => {
      const res = await req("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: 50000,
          type: "income",
          date: "2024-06-15",
          description: "项目收入",
          category: "咨询",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.type).toBe("income");
      expect(body.data.amount).toBe(50000);
      expect(body.data.accountId).toBe(accountId);
      expect(body.data.status).toBe("cleared");

      // Verify account balance was updated
      const acctRes = await req(`/api/v1/accounts/${accountId}`);
      const acct = await acctRes.json();
      expect(acct.data.balance).toBe(50000);
    });

    it("creates an expense transaction and updates balance", async () => {
      const res = await req("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: 15000,
          type: "expense",
          date: "2024-06-20",
          description: "办公用品",
          category: "办公",
        }),
      });
      expect(res.status).toBe(201);

      // Balance should be 50000 - 15000 = 35000
      const acctRes = await req(`/api/v1/accounts/${accountId}`);
      const acct = await acctRes.json();
      expect(acct.data.balance).toBe(35000);
    });

    it("lists transactions with filters", async () => {
      // Filter by type
      const res = await req("/api/v1/transactions?type=income");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].type).toBe("income");

      // Filter by date range
      const res2 = await req("/api/v1/transactions?dateFrom=2024-06-01&dateTo=2024-06-30");
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.data.length).toBe(2);
      expect(body2.meta.total).toBe(2);
    });

    it("rejects invalid transaction (negative amount)", async () => {
      const res = await req("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: -100,
          type: "expense",
          date: "2024-06-25",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent transaction", async () => {
      const res = await req("/api/v1/transactions/00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
    });

    it("deletes a transaction", async () => {
      // Create a transaction first
      const createRes = await req("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: 5000,
          type: "expense",
          date: "2024-06-25",
          description: "待删除",
        }),
      });
      const txId = (await createRes.json()).data.id;

      const res = await req(`/api/v1/transactions/${txId}`, { method: "DELETE" });
      expect(res.status).toBe(200);
    });
  });

  // ── Summary ──

  describe("Summary", () => {
    let accountId: string;

    beforeAll(async () => {
      // Create account and seed transactions for summary
      const acctRes = await req("/api/v1/accounts", {
        method: "POST",
        body: JSON.stringify({ name: "汇总测试账户", type: "bank" }),
      });
      accountId = (await acctRes.json()).data.id;

      await req("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: 100000,
          type: "income",
          date: "2025-03-10",
          description: "Q1 收入",
        }),
      });

      await req("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: 30000,
          type: "expense",
          date: "2025-03-15",
          description: "Q1 支出",
        }),
      });

      await req("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: 80000,
          type: "income",
          date: "2025-04-05",
          description: "Q2 收入",
        }),
      });
    });

    it("returns monthly summary for a year", async () => {
      const res = await req("/api/v1/summary/monthly?year=2025");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(2); // March and April

      const march = body.data.find((s: { month: number }) => s.month === 3);
      expect(march).toBeDefined();
      expect(march.income).toBe(100000);
      expect(march.expense).toBe(30000);
      expect(march.net).toBe(70000);
    });

    it("returns yearly summary", async () => {
      const res = await req("/api/v1/summary/yearly?year=2025");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.totalIncome).toBe(180000);
      expect(body.data.totalExpense).toBe(30000);
      expect(body.data.netIncome).toBe(150000);
      expect(body.data.txCount).toBe(3);
    });

    it("returns period summary", async () => {
      const res = await req("/api/v1/summary/period?dateFrom=2025-03-01&dateTo=2025-03-31");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.totalIncome).toBe(100000);
      expect(body.data.totalExpense).toBe(30000);
      expect(body.data.netIncome).toBe(70000);
    });
  });
});
