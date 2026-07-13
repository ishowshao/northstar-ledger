import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { customers } from "./customers.js";
import { projects } from "./projects.js";

/**
 * 发票表。
 * 记录发票的基本信息、金额汇总和状态流转。
 */
export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  /** 发票编号，如 INV-2024-0001，由系统自动生成 */
  number: text("number").notNull().unique(),
  customerId: text("customer_id").references(() => customers.id),
  projectId: text("project_id").references(() => projects.id),
  status: text("status", {
    enum: ["draft", "sent", "paid", "overdue", "cancelled"],
  })
    .notNull()
    .default("draft"),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  /** 各项明细的汇总金额（最小单位整数），不含税和折扣 */
  subtotal: integer("subtotal").notNull().default(0),
  /** 税率百分比，如 6 表示 6% */
  taxRate: integer("tax_rate").notNull().default(0),
  /** 税额 = subtotal * taxRate / 100 */
  taxAmount: integer("tax_amount").notNull().default(0),
  /** 折扣金额（最小单位整数） */
  discount: integer("discount").notNull().default(0),
  /** 最终金额 = subtotal + taxAmount - discount */
  totalAmount: integer("total_amount").notNull().default(0),
  currency: text("currency", { length: 3 }).notNull().default("CNY"),
  notes: text("notes"),
  /** 客户抬头/发票抬头 */
  billingName: text("billing_name"),
  billingAddress: text("billing_address"),
  sentAt: text("sent_at"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * 发票条目表。
 * 每张发票包含多条明细，如服务项目、单价和数量。
 */
export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  /** 单价（最小单位整数） */
  unitPrice: integer("unit_price").notNull().default(0),
  /** 金额 = quantity * unitPrice */
  amount: integer("amount").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
