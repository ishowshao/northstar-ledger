import { accounts, getDb } from "@northstar/db";
import { DomainError } from "@northstar/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ── Validation Schemas ──

export const CreateAccountSchema = z.object({
  name: z.string().min(1, "账户名称不能为空"),
  type: z.enum(["cash", "bank", "credit", "investment", "other"]).default("bank"),
  currency: z.string().length(3).default("CNY"),
  description: z.string().optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

// ── Service ──

export function listAccounts() {
  const db = getDb();
  return db.select().from(accounts).orderBy(accounts.createdAt).all();
}

export function getAccount(id: string) {
  const db = getDb();
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) {
    throw new DomainError("not_found", `账户 ${id} 不存在`);
  }
  return account;
}

export function createAccount(input: CreateAccountInput) {
  const parsed = CreateAccountSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();
  const id = crypto.randomUUID();
  db.insert(accounts)
    .values({
      id,
      name: parsed.name,
      type: parsed.type,
      currency: parsed.currency,
      description: parsed.description ?? null,
      balance: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getAccount(id);
}

export function updateAccount(id: string, input: UpdateAccountInput) {
  getAccount(id); // 确保存在
  const parsed = UpdateAccountSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();
  db.update(accounts)
    .set({
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.type !== undefined && { type: parsed.type }),
      ...(parsed.currency !== undefined && { currency: parsed.currency }),
      ...(parsed.description !== undefined && { description: parsed.description ?? null }),
      updatedAt: now,
    })
    .where(eq(accounts.id, id))
    .run();
  return getAccount(id);
}

export function deleteAccount(id: string) {
  getAccount(id); // 确保存在
  const db = getDb();
  db.delete(accounts).where(eq(accounts.id, id)).run();
}
