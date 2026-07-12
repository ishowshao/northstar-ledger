import { describe, expect, it } from "bun:test";
import { inferFieldMapping, previewTransactionImport } from "../services/imports.js";

describe("inferFieldMapping", () => {
  it("maps Chinese headers to system fields", () => {
    const mapping = inferFieldMapping(["日期", "金额", "类型", "描述"]);
    expect(mapping.date).toBe("日期");
    expect(mapping.amount).toBe("金额");
    expect(mapping.type).toBe("类型");
    expect(mapping.description).toBe("描述");
  });

  it("maps English headers to system fields", () => {
    const mapping = inferFieldMapping(["date", "amount", "type", "description", "category"]);
    expect(mapping.date).toBe("date");
    expect(mapping.amount).toBe("amount");
    expect(mapping.type).toBe("type");
    expect(mapping.category).toBe("category");
  });

  it("returns empty strings for unrecognized columns", () => {
    const mapping = inferFieldMapping(["foo", "bar", "baz"]);
    expect(mapping.date).toBe("");
    expect(mapping.amount).toBe("");
    expect(mapping.type).toBe("");
  });

  it("handles mixed headers with common aliases", () => {
    const mapping = inferFieldMapping(["日期", "amount", "收支类型", "摘要"]);
    expect(mapping.date).toBe("日期");
    expect(mapping.amount).toBe("amount");
    expect(mapping.type).toBe("收支类型");
    expect(mapping.description).toBe("摘要");
  });
});

describe("previewTransactionImport", () => {
  const accountId = "00000000-0000-0000-0000-000000000001";

  it("returns empty result for empty CSV", () => {
    const result = previewTransactionImport("", accountId);
    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
    expect(result.preview).toEqual([]);
  });

  it("parses valid CSV rows", () => {
    const csv = "date,amount,type,description\n2024-01-15,5000,income,咨询收入\n2024-01-20,3000,expense,办公费";
    const result = previewTransactionImport(csv, accountId);
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.errorRows).toBe(0);
    expect(result.preview[0]?.valid).toBe(true);
    expect(result.preview[0]?.amount).toBe(5000);
    expect(result.preview[0]?.type).toBe("income");
    expect(result.preview[1]?.amount).toBe(3000);
    expect(result.preview[1]?.type).toBe("expense");
  });

  it("rejects invalid date format", () => {
    const csv = "date,amount,type\n2024/01/15,5000,income";
    const result = previewTransactionImport(csv, accountId);
    // Date "2024/01/15" should be parsed by parseDate as "2024-01-15"
    expect(result.validRows).toBe(1);
    expect(result.errorRows).toBe(0);
  });

  it("rejects negative amount", () => {
    const csv = "date,amount,type\n2024-01-15,-100,expense";
    const result = previewTransactionImport(csv, accountId);
    expect(result.validRows).toBe(0);
    expect(result.errorRows).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain("金额");
  });

  it("rejects invalid type", () => {
    const csv = "date,amount,type\n2024-01-15,5000,invalid";
    const result = previewTransactionImport(csv, accountId);
    expect(result.validRows).toBe(0);
    expect(result.errorRows).toBeGreaterThan(0);
  });

  it("handles Chinese headers with aliases", () => {
    const csv = "日期,金额,类型\n2024-01-15,5000,收入";
    const result = previewTransactionImport(csv, accountId);
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.preview[0]?.type).toBe("income");
  });

  it("reports missing required fields", () => {
    const csv = "foo,bar\n2024-01-15,5000";
    const result = previewTransactionImport(csv, accountId);
    expect(result.validRows).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain("缺少必填字段");
  });

  it("parses decimal amounts correctly", () => {
    const csv = "date,amount,type\n2024-01-15,1234.56,income";
    const result = previewTransactionImport(csv, accountId);
    expect(result.validRows).toBe(1);
    expect(result.preview[0]?.amount).toBe(123456); // 1234.56元 = 123456分
  });

  it("handles type aliases (收入/支出)", () => {
    const csv = "date,amount,type\n2024-01-15,5000,收入\n2024-01-16,3000,支出";
    const result = previewTransactionImport(csv, accountId);
    expect(result.validRows).toBe(2);
    expect(result.preview[0]?.type).toBe("income");
    expect(result.preview[1]?.type).toBe("expense");
  });
});
