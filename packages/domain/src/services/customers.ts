import { customers, getDb } from "@northstar/db";
import { DomainError } from "@northstar/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ── Validation Schemas ──

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, "客户名称不能为空"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

// ── Service ──

export function listCustomers() {
  const db = getDb();
  return db.select().from(customers).orderBy(customers.createdAt).all();
}

export function getCustomer(id: string) {
  const db = getDb();
  const customer = db.select().from(customers).where(eq(customers.id, id)).get();
  if (!customer) {
    throw new DomainError("not_found", `客户 ${id} 不存在`);
  }
  return customer;
}

export function createCustomer(input: CreateCustomerInput) {
  const parsed = CreateCustomerSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();
  const id = crypto.randomUUID();
  db.insert(customers)
    .values({
      id,
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
      notes: parsed.notes || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getCustomer(id);
}

export function updateCustomer(id: string, input: UpdateCustomerInput) {
  getCustomer(id);
  const parsed = UpdateCustomerSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();
  db.update(customers)
    .set({
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.email !== undefined && { email: parsed.email || null }),
      ...(parsed.phone !== undefined && { phone: parsed.phone || null }),
      ...(parsed.notes !== undefined && { notes: parsed.notes || null }),
      updatedAt: now,
    })
    .where(eq(customers.id, id))
    .run();
  return getCustomer(id);
}

export function deleteCustomer(id: string) {
  getCustomer(id);
  const db = getDb();
  db.delete(customers).where(eq(customers.id, id)).run();
}
