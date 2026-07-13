import { getDb, invoiceItems, invoices } from "@northstar/db";
import { DomainError } from "@northstar/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ── Validation Schemas ──

export const CreateInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  currency: z.string().length(3).default("CNY"),
  notes: z.string().optional(),
  billingName: z.string().optional(),
  billingAddress: z.string().optional(),
  taxRate: z.number().int().min(0).max(100).default(0),
  discount: z.number().int().min(0).default(0),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "条目描述不能为空"),
        quantity: z.number().int().positive("数量必须大于 0").default(1),
        unitPrice: z.number().int().min(0, "单价不能为负").default(0),
      }),
    )
    .min(1, "发票至少需要一条明细"),
});

export const UpdateInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD")
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD")
    .optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
  billingName: z.string().optional(),
  billingAddress: z.string().optional(),
  taxRate: z.number().int().min(0).max(100).optional(),
  discount: z.number().int().min(0).optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "条目描述不能为空"),
        quantity: z.number().int().positive().default(1),
        unitPrice: z.number().int().min(0).default(0),
      }),
    )
    .optional(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;

export interface InvoiceWithItems {
  invoice: typeof invoices.$inferSelect;
  items: (typeof invoiceItems.$inferSelect)[];
}

// ── Helpers ──

/**
 * 生成发票编号。
 * 格式: INV-{年份}-{四位序号}，如 INV-2025-0001。
 */
function generateInvoiceNumber(): string {
  const db = getDb();
  const year = new Date().getFullYear();

  // 从数据库取最后一张发票编号
  const result = db
    .select({ number: invoices.number })
    .from(invoices)
    .orderBy(invoices.createdAt)
    .all();

  let maxSeq = 0;
  for (const row of result) {
    const match = row.number.match(/^INV-(\d{4})-(\d{4})$/);
    if (match && match[1] === String(year)) {
      const seq = Number.parseInt(match[2]!, 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }

  const nextSeq = maxSeq + 1;
  return `INV-${year}-${String(nextSeq).padStart(4, "0")}`;
}

// ── Service ──

export function listInvoices() {
  const db = getDb();
  return db.select().from(invoices).orderBy(invoices.createdAt).all();
}

export function getInvoice(id: string): InvoiceWithItems {
  const db = getDb();
  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) {
    throw new DomainError("not_found", `发票 ${id} 不存在`);
  }
  const items = db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(invoiceItems.createdAt)
    .all();
  return { invoice, items };
}

export function getInvoiceByNumber(number: string): InvoiceWithItems {
  const db = getDb();
  const invoice = db.select().from(invoices).where(eq(invoices.number, number)).get();
  if (!invoice) {
    throw new DomainError("not_found", `发票 ${number} 不存在`);
  }
  const items = db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoice.id))
    .orderBy(invoiceItems.createdAt)
    .all();
  return { invoice, items };
}

export function createInvoice(input: CreateInvoiceInput): InvoiceWithItems {
  const parsed = CreateInvoiceSchema.parse(input);
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const number = generateInvoiceNumber();

  // 计算金额
  const subtotal = parsed.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.round((subtotal * parsed.taxRate) / 100);
  const totalAmount = subtotal + taxAmount - parsed.discount;

  db.transaction(() => {
    // 创建发票
    db.insert(invoices)
      .values({
        id,
        number,
        customerId: parsed.customerId ?? null,
        projectId: parsed.projectId ?? null,
        status: "draft",
        issueDate: parsed.issueDate,
        dueDate: parsed.dueDate,
        subtotal,
        taxRate: parsed.taxRate,
        taxAmount,
        discount: parsed.discount,
        totalAmount,
        currency: parsed.currency,
        notes: parsed.notes ?? null,
        billingName: parsed.billingName ?? null,
        billingAddress: parsed.billingAddress ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 创建条目
    for (const item of parsed.items) {
      const itemId = crypto.randomUUID();
      const itemAmount = item.quantity * item.unitPrice;
      db.insert(invoiceItems)
        .values({
          id: itemId,
          invoiceId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: itemAmount,
          createdAt: now,
        })
        .run();
    }
  });

  return getInvoice(id);
}

export function updateInvoice(id: string, input: UpdateInvoiceInput): InvoiceWithItems {
  const existing = getInvoice(id);
  if (existing.invoice.status !== "draft") {
    throw new DomainError("conflict", "只有草稿状态的发票可以修改");
  }

  const parsed = UpdateInvoiceSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();

  // 如果提供了 items，重新计算金额
  let subtotal = existing.invoice.subtotal;
  let taxRate = existing.invoice.taxRate;
  let discount = existing.invoice.discount;

  if (parsed.items) {
    subtotal = parsed.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // 删除旧条目，插入新条目
    db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
    for (const item of parsed.items) {
      const itemId = crypto.randomUUID();
      const itemAmount = item.quantity * item.unitPrice;
      db.insert(invoiceItems)
        .values({
          id: itemId,
          invoiceId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: itemAmount,
          createdAt: now,
        })
        .run();
    }
  }

  if (parsed.taxRate !== undefined) taxRate = parsed.taxRate;
  if (parsed.discount !== undefined) discount = parsed.discount;

  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const totalAmount = subtotal + taxAmount - discount;

  db.update(invoices)
    .set({
      ...(parsed.customerId !== undefined && { customerId: parsed.customerId ?? null }),
      ...(parsed.projectId !== undefined && { projectId: parsed.projectId ?? null }),
      ...(parsed.issueDate !== undefined && { issueDate: parsed.issueDate }),
      ...(parsed.dueDate !== undefined && { dueDate: parsed.dueDate }),
      ...(parsed.currency !== undefined && { currency: parsed.currency }),
      ...(parsed.notes !== undefined && { notes: parsed.notes ?? null }),
      ...(parsed.billingName !== undefined && { billingName: parsed.billingName ?? null }),
      ...(parsed.billingAddress !== undefined && { billingAddress: parsed.billingAddress ?? null }),
      ...(parsed.taxRate !== undefined && { taxRate }),
      ...(parsed.discount !== undefined && { discount }),
      subtotal,
      taxAmount,
      totalAmount,
      updatedAt: now,
    })
    .where(eq(invoices.id, id))
    .run();

  return getInvoice(id);
}

export function deleteInvoice(id: string) {
  getInvoice(id); // ensure exists
  const db = getDb();
  db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
  db.delete(invoices).where(eq(invoices.id, id)).run();
}

// ── Status Transitions ──

export function markInvoiceSent(id: string): InvoiceWithItems {
  const existing = getInvoice(id);
  if (existing.invoice.status !== "draft") {
    throw new DomainError(
      "conflict",
      `发票当前状态为 ${existing.invoice.status}，无法标记为已发送`,
    );
  }
  const now = new Date().toISOString();
  const db = getDb();
  db.update(invoices)
    .set({ status: "sent", sentAt: now, updatedAt: now })
    .where(eq(invoices.id, id))
    .run();
  return getInvoice(id);
}

export function markInvoicePaid(id: string): InvoiceWithItems {
  const existing = getInvoice(id);
  if (existing.invoice.status !== "sent" && existing.invoice.status !== "overdue") {
    throw new DomainError(
      "conflict",
      `发票当前状态为 ${existing.invoice.status}，无法标记为已付款`,
    );
  }
  const now = new Date().toISOString();
  const db = getDb();
  db.update(invoices)
    .set({ status: "paid", paidAt: now, updatedAt: now })
    .where(eq(invoices.id, id))
    .run();
  return getInvoice(id);
}

export function markInvoiceOverdue(id: string): InvoiceWithItems {
  const existing = getInvoice(id);
  if (existing.invoice.status !== "sent") {
    throw new DomainError("conflict", `发票当前状态为 ${existing.invoice.status}，无法标记为逾期`);
  }
  const now = new Date().toISOString();
  const db = getDb();
  db.update(invoices).set({ status: "overdue", updatedAt: now }).where(eq(invoices.id, id)).run();
  return getInvoice(id);
}

export function cancelInvoice(id: string): InvoiceWithItems {
  const existing = getInvoice(id);
  if (existing.invoice.status === "paid" || existing.invoice.status === "cancelled") {
    throw new DomainError("conflict", `发票当前状态为 ${existing.invoice.status}，无法取消`);
  }
  const now = new Date().toISOString();
  const db = getDb();
  db.update(invoices).set({ status: "cancelled", updatedAt: now }).where(eq(invoices.id, id)).run();
  return getInvoice(id);
}

// ── Invoice Export ──

/**
 * 将发票导出为 HTML 字符串。
 */
export function exportInvoiceHtml(id: string): string {
  const { invoice, items } = getInvoice(id);

  const statusLabel: Record<string, string> = {
    draft: "草稿",
    sent: "已发送",
    paid: "已付款",
    overdue: "逾期",
    cancelled: "已取消",
  };

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(item.unitPrice / 100).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(item.amount / 100).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>发票 ${invoice.number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #1e293b; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { color: #64748b; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f8fafc; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .totals { text-align: right; margin-top: 20px; }
    .totals p { margin: 4px 0; }
    .total-final { font-size: 20px; font-weight: 700; color: #16a34a; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #f1f5f9; }
    .status-paid { background: #dcfce7; color: #16a34a; }
    .status-draft { background: #fef3c7; color: #d97706; }
    .status-sent { background: #dbeafe; color: #2563eb; }
  </style>
</head>
<body>
  <h1>发票</h1>
  <p class="meta">
    <strong>编号:</strong> ${invoice.number}<br>
    <strong>状态:</strong> <span class="status status-${invoice.status}">${statusLabel[invoice.status] ?? invoice.status}</span><br>
    <strong>开票日期:</strong> ${invoice.issueDate}<br>
    <strong>到期日期:</strong> ${invoice.dueDate}<br>
    ${invoice.billingName ? `<strong>客户抬头:</strong> ${invoice.billingName}<br>` : ""}
    ${invoice.billingAddress ? `<strong>地址:</strong> ${invoice.billingAddress}<br>` : ""}
    ${invoice.notes ? `<strong>备注:</strong> ${invoice.notes}` : ""}
  </p>

  <table>
    <thead>
      <tr>
        <th>项目</th>
        <th style="text-align: center;">数量</th>
        <th style="text-align: right;">单价</th>
        <th style="text-align: right;">金额</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <p>小计: ${(invoice.subtotal / 100).toFixed(2)} ${invoice.currency}</p>
    ${invoice.taxRate > 0 ? `<p>税率: ${invoice.taxRate}% (税额: ${(invoice.taxAmount / 100).toFixed(2)} ${invoice.currency})</p>` : ""}
    ${invoice.discount > 0 ? `<p>折扣: -${(invoice.discount / 100).toFixed(2)} ${invoice.currency}</p>` : ""}
    <p class="total-final">总计: ${(invoice.totalAmount / 100).toFixed(2)} ${invoice.currency}</p>
  </div>
</body>
</html>`;
}
