import { describe, expect, it } from "bun:test";
import { CreateAccountSchema } from "../services/accounts.js";
import { CreateTransactionSchema } from "../services/transactions.js";

describe("Accounts Service - Schema Validation", () => {
  it("validates valid account input", () => {
    const result = CreateAccountSchema.safeParse({ name: "测试账户" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateAccountSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("applies defaults", () => {
    const result = CreateAccountSchema.parse({ name: "测试" });
    expect(result.type).toBe("bank");
    expect(result.currency).toBe("CNY");
  });
});

describe("Transactions Service - Schema Validation", () => {
  it("validates valid transaction input", () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      amount: 1000,
      type: "income",
      date: "2024-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      amount: -100,
      type: "income",
      date: "2024-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      amount: 100,
      type: "income",
      date: "2024/01/15",
    });
    expect(result.success).toBe(false);
  });
});
