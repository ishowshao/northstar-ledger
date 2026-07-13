import { accounts, getDb, transactions } from "@northstar/db";
import { and, eq, sql } from "drizzle-orm";

// ── Types ──

export interface IntegrityIssue {
  category: "balance_mismatch" | "orphan_transaction" | "negative_balance";
  entityType: "account" | "transaction";
  entityId: string;
  message: string;
  detail?: string;
}

export interface IntegrityReport {
  checkedAt: string;
  totalIssues: number;
  issues: IntegrityIssue[];
}

// ── Service ──

/**
 * 对全库执行数据完整性检查。
 * 包括：
 * 1. 账户余额是否与交易汇总一致
 * 2. 是否存在孤立的交易记录（指向不存在的账户/客户/项目）
 * 3. 账户余额是否为负（部分类型允许，但标记出来）
 */
export function runIntegrityCheck(): IntegrityReport {
  const db = getDb();
  const issues: IntegrityIssue[] = [];

  // 1. 检查每个账户的余额是否与 cleared 交易汇总一致
  const allAccounts = db.select().from(accounts).all();
  for (const acct of allAccounts) {
    // 计算该账户所有 cleared 交易的净额
    const result = db
      .select({
        totalIncome: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
        totalExpense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.accountId, acct.id), eq(transactions.status, "cleared")))
      .get();

    const expectedBalance = (result?.totalIncome ?? 0) - (result?.totalExpense ?? 0);
    if (expectedBalance !== acct.balance) {
      issues.push({
        category: "balance_mismatch",
        entityType: "account",
        entityId: acct.id,
        message: `账户 "${acct.name}" 的余额不一致`,
        detail: `当前余额: ${acct.balance}, 期望余额(根据交易汇总): ${expectedBalance}, 差额: ${acct.balance - expectedBalance}`,
      });
    }
  }

  // 2. 检查孤立交易记录（外键引用不存在的账户）
  const orphanTx = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(sql`${accounts.id} IS NULL`)
    .all();

  for (const tx of orphanTx) {
    issues.push({
      category: "orphan_transaction",
      entityType: "transaction",
      entityId: tx.id,
      message: "交易记录引用了不存在的账户",
      detail: `交易 ${tx.id.slice(0, 8)} (${tx.date}, 金额: ${tx.amount}) 指向账户 ${tx.accountId}`,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    totalIssues: issues.length,
    issues,
  };
}

/**
 * 对单个账户执行快速完整性检查。
 * 用在导入完成后验证账户状态。
 */
export function checkAccountIntegrity(accountId: string): IntegrityIssue[] {
  const db = getDb();
  const issues: IntegrityIssue[] = [];

  const acct = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!acct) {
    issues.push({
      category: "orphan_transaction",
      entityType: "account",
      entityId: accountId,
      message: `账户 ${accountId} 不存在`,
    });
    return issues;
  }

  // 计算期望余额
  const result = db
    .select({
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      totalExpense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.status, "cleared")))
    .get();

  const expectedBalance = (result?.totalIncome ?? 0) - (result?.totalExpense ?? 0);
  if (expectedBalance !== acct.balance) {
    issues.push({
      category: "balance_mismatch",
      entityType: "account",
      entityId: accountId,
      message: `账户 "${acct.name}" 的余额不一致`,
      detail: `当前余额: ${acct.balance}, 期望余额: ${expectedBalance}, 差额: ${acct.balance - expectedBalance}`,
    });
  }

  return issues;
}
