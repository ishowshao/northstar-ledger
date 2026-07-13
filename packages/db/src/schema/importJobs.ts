import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 导入任务记录表。
 * 每次 CSV 导入都会创建一条记录，跟踪状态、结果和错误明细。
 */
export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type", {
    enum: ["transactions", "accounts", "customers", "projects"],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "preview", "running", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  fileName: text("file_name"),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  params: text("params"), // JSON: { csv, accountId, mapping } for async execution
  progress: integer("progress").notNull().default(0), // 0-100 进度百分比
  errors: text("errors"), // JSON array of {row, field, message}
  summary: text("summary"), // JSON free-form summary message
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
