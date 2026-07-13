import { customers, getDb, invoices, projects, transactions } from "@northstar/db";
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

/** 项目盈利报表 */
export interface ProjectProfitability {
  projectId: string;
  projectName: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  txCount: number;
  /** 来自发票的收入（已付款发票） */
  invoicedAmount: number;
}

/** 客户收入报表 */
export interface CustomerRevenue {
  customerId: string;
  customerName: string;
  totalIncome: number;
  totalExpense: number;
  netRevenue: number;
  txCount: number;
  invoiceCount: number;
  invoiceTotal: number;
}

/** 现金流报表 */
export interface CashFlow {
  period: string; // YYYY-MM
  inflow: number;
  outflow: number;
  netFlow: number;
  endingBalance: number;
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

// ── Project Profitability ──

export function getProjectProfitability(
  dateFrom?: string,
  dateTo?: string,
): ProjectProfitability[] {
  const db = getDb();

  const whereConditions = [sql`status != 'void'`];
  if (dateFrom) whereConditions.push(gte(transactions.date, dateFrom));
  if (dateTo) whereConditions.push(lte(transactions.date, dateTo));

  const txResults = db
    .select({
      projectId: transactions.projectId,
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      totalExpense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      txCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(...whereConditions))
    .groupBy(transactions.projectId)
    .all();

  const allProjects = db.select().from(projects).all();
  const projectMap = new Map(allProjects.map((p) => [p.id, p]));

  // 获取每张发票按项目汇总的已付款金额
  const invoiceByProject = db
    .select({
      projectId: invoices.projectId,
      invoicedAmount: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.status, "paid"))
    .groupBy(invoices.projectId)
    .all();

  const invoiceMap = new Map<string, number>();
  for (const row of invoiceByProject) {
    if (row.projectId) invoiceMap.set(row.projectId, row.invoicedAmount);
  }

  const results: ProjectProfitability[] = [];

  for (const row of txResults) {
    if (!row.projectId) continue;
    const project = projectMap.get(row.projectId);
    results.push({
      projectId: row.projectId,
      projectName: project?.name ?? "(已删除)",
      totalIncome: row.totalIncome,
      totalExpense: row.totalExpense,
      netProfit: row.totalIncome - row.totalExpense,
      txCount: row.txCount,
      invoicedAmount: invoiceMap.get(row.projectId) ?? 0,
    });
  }

  results.sort((a, b) => b.netProfit - a.netProfit);
  return results;
}

// ── Customer Revenue ──

export function getCustomerRevenue(dateFrom?: string, dateTo?: string): CustomerRevenue[] {
  const db = getDb();

  const whereConditions = [sql`status != 'void'`];
  if (dateFrom) whereConditions.push(gte(transactions.date, dateFrom));
  if (dateTo) whereConditions.push(lte(transactions.date, dateTo));

  const txResults = db
    .select({
      customerId: transactions.customerId,
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      totalExpense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      txCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(...whereConditions))
    .groupBy(transactions.customerId)
    .all();

  // 发票统计按客户
  const invoiceResults = db
    .select({
      customerId: invoices.customerId,
      invoiceCount: sql<number>`COUNT(*)`,
      invoiceTotal: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
    })
    .from(invoices)
    .groupBy(invoices.customerId)
    .all();

  const invoiceMap = new Map(
    invoiceResults
      .filter((r) => r.customerId)
      .map((r) => [r.customerId!, { count: r.invoiceCount, total: r.invoiceTotal }]),
  );

  const allCustomers = db.select().from(customers).all();
  const customerMap = new Map(allCustomers.map((c) => [c.id, c]));

  return txResults
    .filter((r) => r.customerId)
    .map((r) => {
      const inv = r.customerId ? invoiceMap.get(r.customerId) : undefined;
      const c = r.customerId ? customerMap.get(r.customerId) : undefined;
      return {
        customerId: r.customerId!,
        customerName: c?.name ?? "(已删除)",
        totalIncome: r.totalIncome,
        totalExpense: r.totalExpense,
        netRevenue: r.totalIncome - r.totalExpense,
        txCount: r.txCount,
        invoiceCount: inv?.count ?? 0,
        invoiceTotal: inv?.total ?? 0,
      };
    });
}

// ── Cash Flow ──

export function getCashFlow(year: number): CashFlow[] {
  const db = getDb();

  const results = db
    .select({
      period: sql<string>`strftime('%Y-%m', date)`,
      inflow: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      outflow: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(sql`strftime('%Y', date) = ${String(year)}`, sql`status != 'void'`))
    .groupBy(sql`strftime('%Y-%m', date)`)
    .orderBy(sql`strftime('%Y-%m', date)`)
    .all();

  let runningBalance = 0;
  return results.map((r) => {
    const netFlow = r.inflow - r.outflow;
    runningBalance += netFlow;
    return {
      period: r.period,
      inflow: r.inflow,
      outflow: r.outflow,
      netFlow,
      endingBalance: runningBalance,
    };
  });
}
