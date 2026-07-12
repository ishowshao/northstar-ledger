import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { customers } from "./customers.js";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  customerId: text("customer_id").references(() => customers.id),
  status: text("status", { enum: ["active", "completed", "cancelled"] })
    .notNull()
    .default("active"),
  hourlyRate: integer("hourly_rate"),
  currency: text("currency", { length: 3 }).default("CNY"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
