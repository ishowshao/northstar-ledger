import type { CurrencyCode, MoneyAmount } from "./types/index.js";

/**
 * Money 值对象。
 * 金额以最小货币单位（分/美分）的整数存储，避免浮点精度问题。
 */
export class Money {
  constructor(
    public readonly amount: MoneyAmount,
    public readonly currency: CurrencyCode,
  ) {}

  static fromFloat(amount: number, currency: CurrencyCode, decimals = 2): Money {
    const integer = Math.round(amount * 10 ** decimals);
    return new Money(integer, currency);
  }

  toFloat(decimals = 2): number {
    return this.amount / 10 ** decimals;
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error("Cannot add money with different currencies");
    }
    return new Money((this.amount + other.amount) as MoneyAmount, this.currency);
  }

  subtract(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error("Cannot subtract money with different currencies");
    }
    return new Money((this.amount - other.amount) as MoneyAmount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }
}
