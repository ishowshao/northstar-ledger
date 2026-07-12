import { getDb, transactions } from "@northstar/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";

// ── Types ──

export interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  txCount: number;
}

export interface PeriodSummary {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  txCount: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  txCount: number;
}

// ── Service ──

export function getMonthlySummary(year: number, month?: number): MonthlySummary[] {
  const db = getDb();

  let whereClause = sql`strftime('%Y', date) = ${String(year)}`;
  if (month) {
    whereClause =
      and(whereClause, sql`strftime('%m', date) = ${String(month).padStart(2, "0")}`) ??
      whereClause;
  }

  const results = db
    .select({
      year: sql<number>`CAST(strftime('%Y', date) AS INTEGER)`,
      month: sql<number>`CAST(strftime('%m', date) AS INTEGER)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      txCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(whereClause, sql`status != 'void'`))
    .groupBy(sql`strftime('%Y-%m', date)`)
    .orderBy(sql`strftime('%Y-%m', date)`)
    .all();

  return results.map((r) => ({
    year: r.year,
    month: r.month,
    income: r.income,
    expense: r.expense,
    net: r.income - r.expense,
    txCount: r.txCount,
  }));
}

export function getPeriodSummary(dateFrom: string, dateTo: string): PeriodSummary {
  const db = getDb();

  const result = db
    .select({
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      totalExpense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      txCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(gte(transactions.date, dateFrom), lte(transactions.date, dateTo), sql`status != 'void'`),
    )
    .get();

  return {
    totalIncome: result?.totalIncome ?? 0,
    totalExpense: result?.totalExpense ?? 0,
    netIncome: (result?.totalIncome ?? 0) - (result?.totalExpense ?? 0),
    txCount: result?.txCount ?? 0,
  };
}

export function getCategoryBreakdown(dateFrom: string, dateTo: string): CategoryBreakdown[] {
  const db = getDb();

  const total = db
    .select({
      totalAmount: sql<number>`COALESCE(SUM(amount), 0)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
        sql`type = 'expense'`,
        sql`status != 'void'`,
      ),
    )
    .get();

  const totalAmount = total?.totalAmount ?? 0;

  const rows = db
    .select({
      category: transactions.category,
      amount: sql<number>`COALESCE(SUM(amount), 0)`,
      txCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, dateFrom),
        lte(transactions.date, dateTo),
        sql`type = 'expense'`,
        sql`status != 'void'`,
      ),
    )
    .groupBy(transactions.category)
    .orderBy(sql`SUM(amount) DESC`)
    .all();

  return rows.map((r) => ({
    category: r.category ?? "未分类",
    amount: r.amount,
    percentage: totalAmount > 0 ? Math.round((r.amount / totalAmount) * 10000) / 100 : 0,
    txCount: r.txCount,
  }));
}

export function getYearSummary(year: number): PeriodSummary {
  return getPeriodSummary(`${year}-01-01`, `${year}-12-31`);
}
