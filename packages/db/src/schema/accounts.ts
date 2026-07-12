import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["cash", "bank", "credit", "investment", "other"] })
    .notNull()
    .default("bank"),
  currency: text("currency", { length: 3 }).notNull().default("CNY"),
  balance: integer("balance").notNull().default(0),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
