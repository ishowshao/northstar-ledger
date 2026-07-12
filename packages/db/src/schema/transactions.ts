import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { accounts } from "./accounts.js";

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  customerId: text("customer_id"),
  projectId: text("project_id"),
  type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
  status: text("status", { enum: ["pending", "cleared", "reconciled", "void"] })
    .notNull()
    .default("cleared"),
  amount: integer("amount").notNull(),
  currency: text("currency", { length: 3 }).notNull().default("CNY"),
  description: text("description"),
  category: text("category"),
  date: text("date").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
