import { describe, expect, it } from "bun:test";
import { Money } from "../money.js";

describe("Money", () => {
  it("creates from integer amount", () => {
    const m = new Money(100, "CNY");
    expect(m.amount).toBe(100);
    expect(m.currency).toBe("CNY");
  });

  it("creates from float", () => {
    const m = Money.fromFloat(10.5, "USD");
    expect(m.amount).toBe(1050);
    expect(m.currency).toBe("USD");
  });

  it("converts to float", () => {
    const m = new Money(1050, "USD");
    expect(m.toFloat()).toBe(10.5);
  });

  it("adds money with same currency", () => {
    const a = new Money(100, "CNY");
    const b = new Money(200, "CNY");
    const result = a.add(b);
    expect(result.amount).toBe(300);
    expect(result.currency).toBe("CNY");
  });

  it("throws when adding different currencies", () => {
    const a = new Money(100, "CNY");
    const b = new Money(100, "USD");
    expect(() => a.add(b)).toThrow("different currencies");
  });

  it("subtracts money", () => {
    const a = new Money(300, "CNY");
    const b = new Money(100, "CNY");
    const result = a.subtract(b);
    expect(result.amount).toBe(200);
  });

  it("checks equality", () => {
    const a = new Money(100, "CNY");
    const b = new Money(100, "CNY");
    const c = new Money(200, "CNY");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("detects negative", () => {
    expect(new Money(-1, "CNY").isNegative()).toBe(true);
    expect(new Money(0, "CNY").isNegative()).toBe(false);
    expect(new Money(1, "CNY").isNegative()).toBe(false);
  });
});
