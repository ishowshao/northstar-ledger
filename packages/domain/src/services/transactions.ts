import { accounts, getDb, transactions } from "@northstar/db";
import { DomainError } from "@northstar/shared";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

// ── Validation Schemas ──

export const CreateTransactionSchema = z.object({
  accountId: z.string().uuid("账户 ID 格式无效"),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  type: z.enum(["income", "expense", "transfer"]),
  status: z.enum(["pending", "cleared", "reconciled", "void"]).default("cleared"),
  amount: z.number().int("金额必须为整数（最小货币单位）").positive("金额必须大于 0"),
  currency: z.string().length(3).default("CNY"),
  description: z.string().optional(),
  category: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  note: z.string().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

// ── Query Filters ──

export interface TransactionFilters {
  accountId?: string;
  customerId?: string;
  projectId?: string;
  type?: "income" | "expense" | "transfer";
  status?: "pending" | "cleared" | "reconciled" | "void";
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

// ── Service ──

export function listTransactions(filters: TransactionFilters = {}) {
  const db = getDb();
  const conditions = [];

  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.customerId) conditions.push(eq(transactions.customerId, filters.customerId));
  if (filters.projectId) conditions.push(eq(transactions.projectId, filters.projectId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.status) conditions.push(eq(transactions.status, filters.status));
  if (filters.category) conditions.push(eq(transactions.category, filters.category));
  if (filters.dateFrom) conditions.push(gte(transactions.date, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(transactions.date, filters.dateTo));

  const query = db
    .select()
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return query.all();
}

export function getTransaction(id: string) {
  const db = getDb();
  const tx = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!tx) {
    throw new DomainError("not_found", `交易 ${id} 不存在`);
  }
  return tx;
}

export function createTransaction(input: CreateTransactionInput) {
  const parsed = CreateTransactionSchema.parse(input);

  // 验证账户存在
  const db = getDb();
  const account = db.select().from(accounts).where(eq(accounts.id, parsed.accountId)).get();
  if (!account) {
    throw new DomainError("not_found", `账户 ${parsed.accountId} 不存在`);
  }

  // 金额校验
  if (parsed.amount <= 0) {
    throw new DomainError("validation", "金额必须大于 0");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const tx = db.transaction(() => {
    // 插入交易记录
    db.insert(transactions)
      .values({
        id,
        accountId: parsed.accountId,
        customerId: parsed.customerId ?? null,
        projectId: parsed.projectId ?? null,
        type: parsed.type,
        status: parsed.status,
        amount: parsed.amount,
        currency: parsed.currency,
        description: parsed.description ?? null,
        category: parsed.category ?? null,
        date: parsed.date,
        note: parsed.note ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 更新账户余额
    if (parsed.type === "income") {
      db.update(accounts)
        .set({ balance: sql`balance + ${parsed.amount}`, updatedAt: now })
        .where(eq(accounts.id, parsed.accountId))
        .run();
    } else if (parsed.type === "expense") {
      db.update(accounts)
        .set({ balance: sql`balance - ${parsed.amount}`, updatedAt: now })
        .where(eq(accounts.id, parsed.accountId))
        .run();
    }

    return id;
  });

  return getTransaction(tx);
}

export function updateTransaction(id: string, input: UpdateTransactionInput) {
  const existing = getTransaction(id);
  if (existing.status === "void") {
    throw new DomainError("conflict", "已作废的交易无法修改");
  }

  const parsed = UpdateTransactionSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();

  db.update(transactions)
    .set({
      ...(parsed.accountId !== undefined && { accountId: parsed.accountId }),
      ...(parsed.customerId !== undefined && { customerId: parsed.customerId ?? null }),
      ...(parsed.projectId !== undefined && { projectId: parsed.projectId ?? null }),
      ...(parsed.type !== undefined && { type: parsed.type }),
      ...(parsed.status !== undefined && { status: parsed.status }),
      ...(parsed.amount !== undefined && { amount: parsed.amount }),
      ...(parsed.currency !== undefined && { currency: parsed.currency }),
      ...(parsed.description !== undefined && { description: parsed.description ?? null }),
      ...(parsed.category !== undefined && { category: parsed.category ?? null }),
      ...(parsed.date !== undefined && { date: parsed.date }),
      ...(parsed.note !== undefined && { note: parsed.note ?? null }),
      updatedAt: now,
    })
    .where(eq(transactions.id, id))
    .run();

  return getTransaction(id);
}

export function deleteTransaction(id: string) {
  getTransaction(id);
  const db = getDb();
  db.delete(transactions).where(eq(transactions.id, id)).run();
}

export function getTransactionCount(filters: TransactionFilters = {}): number {
  const db = getDb();
  const conditions = [];

  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.customerId) conditions.push(eq(transactions.customerId, filters.customerId));
  if (filters.projectId) conditions.push(eq(transactions.projectId, filters.projectId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.status) conditions.push(eq(transactions.status, filters.status));
  if (filters.category) conditions.push(eq(transactions.category, filters.category));
  if (filters.dateFrom) conditions.push(gte(transactions.date, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(transactions.date, filters.dateTo));

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return result?.count ?? 0;
}
