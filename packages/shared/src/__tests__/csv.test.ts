import { describe, expect, it } from "bun:test";
import { parseAmount, parseCsv, parseCurrency, parseDate } from "../csv.js";

describe("parseCsv", () => {
  it("parses simple CSV with header", () => {
    const csv = "name,amount,date\n收入1,5000,2024-01-15\n收入2,3000,2024-01-20";
    const result = parseCsv(csv);
    expect(result.headers).toEqual(["name", "amount", "date"]);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0]?.fields).toEqual({ name: "收入1", amount: "5000", date: "2024-01-15" });
    expect(result.rows[1]?.fields).toEqual({ name: "收入2", amount: "3000", date: "2024-01-20" });
  });

  it("handles quoted fields", () => {
    const csv = 'name,note\nAlice,"hello, world"\nBob,"say ""hi"""';
    const result = parseCsv(csv);
    expect(result.rows[0]?.fields.note).toBe("hello, world");
    expect(result.rows[1]?.fields.note).toBe('say "hi"');
  });

  it("handles empty lines", () => {
    const csv = "a,b\n1,2\n\n3,4\n";
    const result = parseCsv(csv);
    expect(result.totalRows).toBe(2);
  });

  it("parses without header", () => {
    const csv = "a,b\nc,d";
    const result = parseCsv(csv, { hasHeader: false });
    expect(result.headers).toEqual([]);
    expect(result.rows[0]?.fields).toEqual({ col1: "a", col2: "b" });
    expect(result.rows[1]?.fields).toEqual({ col1: "c", col2: "d" });
  });

  it("handles custom delimiter", () => {
    const csv = "a|b\n1|2";
    const result = parseCsv(csv, { delimiter: "|" });
    expect(result.rows[0]?.fields).toEqual({ a: "1", b: "2" });
  });

  it("returns empty result for empty input", () => {
    const result = parseCsv("");
    expect(result.totalRows).toBe(0);
    expect(result.rows).toEqual([]);
  });
});

describe("parseAmount", () => {
  it("parses integer amount", () => {
    expect(parseAmount("5000")).toBe(5000);
  });

  it("parses decimal amount (2 decimals)", () => {
    expect(parseAmount("12.34")).toBe(1234);
    expect(parseAmount("0.01")).toBe(1);
    expect(parseAmount("100.00")).toBe(10000);
  });

  it("parses amount with thousands separator", () => {
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("10,000")).toBe(10000); // 无小数点，直接视为最小单位
  });

  it("parses negative amount", () => {
    expect(parseAmount("-500")).toBe(-500);
    expect(parseAmount("-1,234.56")).toBe(-123456);
  });

  it("returns null for invalid amount", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("handles custom decimals", () => {
    expect(parseAmount("12.345", 3)).toBe(12345);
    expect(parseAmount("12.34", 0)).toBe(12);
  });
});

describe("parseDate", () => {
  it("keeps YYYY-MM-DD unchanged", () => {
    expect(parseDate("2024-01-15")).toBe("2024-01-15");
  });

  it("converts YYYY/MM/DD", () => {
    expect(parseDate("2024/01/15")).toBe("2024-01-15");
  });

  it("converts DD/MM/YYYY", () => {
    expect(parseDate("15/01/2024")).toBe("2024-01-15");
  });

  it("returns null for empty input", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("  ")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });
});

describe("parseCurrency", () => {
  it("parses valid currency codes", () => {
    expect(parseCurrency("CNY")).toBe("CNY");
    expect(parseCurrency("usd")).toBe("USD");
    expect(parseCurrency("eur")).toBe("EUR");
  });

  it("returns null for invalid currency", () => {
    expect(parseCurrency("BTC")).toBeNull();
    expect(parseCurrency("")).toBeNull();
  });
});
