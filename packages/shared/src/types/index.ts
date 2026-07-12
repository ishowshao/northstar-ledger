import { z } from "zod";

// ── 货币与金额 ──

export type CurrencyCode = "CNY" | "USD" | "EUR" | "JPY" | "GBP";

export const CurrencyCodeSchema = z.enum(["CNY", "USD", "EUR", "JPY", "GBP"]);

// ── 交易类型 ──

export const TransactionTypeSchema = z.enum(["income", "expense", "transfer"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

// ── 交易状态 ──

export const TransactionStatusSchema = z.enum(["pending", "cleared", "reconciled", "void"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

// ── 基础实体 ID ──

export const IdSchema = z.string().uuid();
export type Id = string & { __brand: "Id" };

// ── 货币金额（最小单位整数，如 分 / 美分） ──

export const MoneyAmountSchema = z.number().int();
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;
