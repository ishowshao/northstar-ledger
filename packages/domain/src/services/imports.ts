import { accounts, getDb, importJobs, transactions } from "@northstar/db";
import { DomainError, parseAmount, parseCsv, parseDate } from "@northstar/shared";
import { and, eq, sql } from "drizzle-orm";
import { checkAccountIntegrity } from "./integrity.js";
import { createTransaction } from "./transactions.js";

// ── 字段映射配置 ──

export interface ImportFieldMapping {
  /** CSV 列名 → 目标字段名 */
  date: string;
  amount: string;
  type: string;
  description?: string;
  category?: string;
  note?: string;
}

export const DefaultFieldMapping: ImportFieldMapping = {
  date: "date",
  amount: "amount",
  type: "type",
  description: "description",
  category: "category",
  note: "note",
};

// ── 通用列名校准时映射（中英文兼容） ──

const COMMON_ALIASES: Record<string, string> = {
  date: "date",
  日期: "date",
  交易日期: "date",
  时间: "date",

  amount: "amount",
  金额: "amount",
  交易金额: "amount",
  收入金额: "amount",
  支出金额: "amount",

  type: "type",
  类型: "type",
  交易类型: "type",
  收支类型: "type",
  方向: "type",

  description: "description",
  描述: "description",
  摘要: "description",
  交易描述: "description",
  备注: "note",
  说明: "note",
  note: "note",

  category: "category",
  分类: "category",
  类别: "category",

  accountId: "accountId",
  账户: "accountId",
  账户ID: "accountId",

  customerId: "customerId",
  客户: "customerId",
  客户ID: "customerId",

  projectId: "projectId",
  项目: "projectId",
  项目ID: "projectId",
};

/**
 * 自动推断 CSV 列名到系统字段的映射。
 * 返回 { targetField: csvColumnName } 的映射。
 */
export function inferFieldMapping(headers: string[]): ImportFieldMapping {
  const map = new Map<string, string>();
  for (const header of headers) {
    const trimmed = header.trim();
    const target = COMMON_ALIASES[trimmed];
    if (target) {
      map.set(target, trimmed);
    }
  }

  return {
    date: map.get("date") ?? "",
    amount: map.get("amount") ?? "",
    type: map.get("type") ?? "",
    description: map.get("description") ?? "",
    category: map.get("category") ?? "",
    note: map.get("note") ?? "",
  };
}

// ── 导入结果 ──

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: Array<{ row: number; field: string; message: string; value?: string }>;
  preview: Array<{
    row: number;
    type: string;
    amount: number;
    currency: string;
    date: string;
    description: string;
    category: string;
    note: string;
    valid: boolean;
  }>;
}

export interface ImportExecuteResult extends ImportPreviewResult {
  jobId: string;
  importedRows: number;
}

// ── 导入服务 ──

/**
 * 检测 CSV 中的行是否与数据库中已有的交易重复。
 * 规则：同一账户下，日期、金额、类型、描述完全相同视为重复。
 */
function detectDuplicates(
  rows: Array<{
    date: string;
    amount: number;
    type: string;
    description: string;
  }>,
  accountId: string,
): Set<number> {
  try {
    const db = getDb();
    const duplicateRows = new Set<number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (!row.date || !row.amount || !row.type) continue;

      const existing = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, accountId),
            eq(transactions.date, row.date),
            eq(transactions.amount, row.amount),
            eq(transactions.type, row.type as "income" | "expense" | "transfer"),
            row.description
              ? eq(transactions.description, row.description)
              : sql`(${transactions.description} IS NULL OR ${transactions.description} = '')`,
          ),
        )
        .get();

      if (existing) {
        duplicateRows.add(i);
      }
    }

    return duplicateRows;
  } catch {
    // 数据库不可用时不执行重复检测（如单元测试环境）
    return new Set<number>();
  }
}

/**
 * 预览 CSV 导入结果（不写入数据库）。
 * 接收 CSV 文本、账户 ID、可选字段映射。
 */
export function previewTransactionImport(
  csvText: string,
  accountId: string,
  mapping?: ImportFieldMapping,
): ImportPreviewResult {
  const errors: Array<{ row: number; field: string; message: string; value?: string }> = [];
  const preview: Array<{
    row: number;
    type: string;
    amount: number;
    currency: string;
    date: string;
    description: string;
    category: string;
    note: string;
    valid: boolean;
  }> = [];

  // 1. 解析 CSV
  const parsed = parseCsv(csvText);
  if (parsed.totalRows === 0) {
    return { totalRows: 0, validRows: 0, errorRows: 0, duplicateRows: 0, errors: [], preview: [] };
  }

  // 2. 自动推断映射（如果未提供）
  const effectiveMapping = mapping ?? inferFieldMapping(parsed.headers);
  const missingFields = [];
  if (!effectiveMapping.date) missingFields.push("date(日期)");
  if (!effectiveMapping.amount) missingFields.push("amount(金额)");
  if (!effectiveMapping.type) missingFields.push("type(类型)");

  if (missingFields.length > 0) {
    return {
      totalRows: parsed.totalRows,
      validRows: 0,
      errorRows: parsed.totalRows,
      duplicateRows: 0,
      errors: [
        { row: 0, field: "mapping", message: `缺少必填字段映射: ${missingFields.join(", ")}` },
      ],
      preview: [],
    };
  }

  // 3. 逐行校验
  const parsedRows: Array<{
    rowNumber: number;
    date: string;
    amount: number;
    type: string | null;
    description: string;
    category: string;
    note: string;
    valid: boolean;
    parseErrors: Array<{ field: string; message: string; value?: string }>;
  }> = [];

  for (const row of parsed.rows) {
    const rowErrors: Array<{ row: number; field: string; message: string; value?: string }> = [];
    const fields = row.fields;

    // 日期
    const rawDate = fields[effectiveMapping.date] ?? "";
    const date = parseDate(rawDate);

    // 金额
    const rawAmount = fields[effectiveMapping.amount] ?? "";
    const amount = parseAmount(rawAmount);

    // 类型
    const rawType = fields[effectiveMapping.type] ?? "";
    const type = normalizeType(rawType);

    // 描述
    const description = effectiveMapping.description
      ? (fields[effectiveMapping.description] ?? "")
      : "";

    // 分类
    const category = effectiveMapping.category ? (fields[effectiveMapping.category] ?? "") : "";

    // 备注
    const note = effectiveMapping.note ? (fields[effectiveMapping.note] ?? "") : "";

    // 校验
    if (!date) {
      rowErrors.push({
        row: row.rowNumber,
        field: effectiveMapping.date,
        message: "无效的日期格式",
        value: rawDate,
      });
    }
    if (amount === null) {
      rowErrors.push({
        row: row.rowNumber,
        field: effectiveMapping.amount,
        message: "无效的金额格式",
        value: rawAmount,
      });
    } else if (amount <= 0) {
      rowErrors.push({
        row: row.rowNumber,
        field: effectiveMapping.amount,
        message: "金额必须大于 0",
        value: rawAmount,
      });
    }
    if (!type) {
      rowErrors.push({
        row: row.rowNumber,
        field: effectiveMapping.type,
        message: "无效的交易类型，需为 income/expense/transfer",
        value: rawType,
      });
    }

    const valid = rowErrors.length === 0;
    errors.push(...rowErrors);

    const rowData = {
      rowNumber: row.rowNumber,
      date: date ?? "",
      amount: amount ?? 0,
      type,
      description,
      category,
      note,
      valid,
      parseErrors: rowErrors,
    };

    parsedRows.push(rowData);
    preview.push({
      row: row.rowNumber,
      type: type ?? "unknown",
      amount: amount ?? 0,
      currency: "CNY",
      date: date ?? "",
      description,
      category,
      note,
      valid,
    });
  }

  // 4. 重复检测（仅对有有效日期、金额和类型的行）
  const validRowsForDedup = parsedRows
    .filter((r) => r.valid && r.date && r.amount > 0 && r.type)
    .map((r) => ({
      index: parsedRows.indexOf(r),
      date: r.date,
      amount: r.amount,
      type: r.type!,
      description: r.description,
    }));

  const duplicateIndices = detectDuplicates(validRowsForDedup, accountId);

  // 标记重复行
  for (const idx of duplicateIndices) {
    const rowInfo = validRowsForDedup.find((r) => r.index === idx);
    if (rowInfo !== undefined) {
      const parsedRow = parsedRows[rowInfo.index]!;
      // 把重复行标记为无效
      parsedRow.valid = false;
      errors.push({
        row: parsedRow.rowNumber,
        field: "system",
        message: "与数据库中已有记录重复",
        value: `日期: ${parsedRow.date}, 金额: ${parsedRow.amount}, 类型: ${parsedRow.type}`,
      });
      // 更新 preview 中的 valid
      const previewEntry = preview.find((p) => p.row === parsedRow.rowNumber);
      if (previewEntry) {
        previewEntry.valid = false;
      }
    }
  }

  const validCount = parsedRows.filter((r) => r.valid).length;
  const duplicateCount = duplicateIndices.size;

  return {
    totalRows: parsed.totalRows,
    validRows: validCount,
    errorRows: errors.length,
    duplicateRows: duplicateCount,
    errors,
    preview,
  };
}

/**
 * 执行 CSV 导入（写入数据库）。
 * 在事务中原子写入：失败时全部回滚。
 * 导入完成后自动执行账户完整性检查。
 */
export function executeTransactionImport(
  csvText: string,
  accountId: string,
  mapping?: ImportFieldMapping,
): ImportExecuteResult {
  const db = getDb();

  // 1. 预览
  const preview = previewTransactionImport(csvText, accountId, mapping);

  // 2. 创建导入任务记录
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  db.insert(importJobs)
    .values({
      id: jobId,
      entityType: "transactions",
      status: "running",
      fileName: undefined,
      params: JSON.stringify({ csv: csvText, accountId, mapping }),
      totalRows: preview.totalRows,
      validRows: preview.validRows,
      errorRows: preview.errorRows,
      duplicateRows: preview.duplicateRows,
      importedRows: 0,
      progress: 0,
      errors: JSON.stringify(preview.errors),
      summary: null,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (preview.validRows === 0) {
    db.update(importJobs)
      .set({
        status: "completed",
        importedRows: 0,
        progress: 100,
        summary: JSON.stringify({ message: "没有有效的行可导入" }),
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(importJobs.id, jobId))
      .run();

    return { ...preview, jobId, importedRows: 0 };
  }

  // 3. 在事务中导入
  let importedCount = 0;
  const rowErrors: Array<{ row: number; field: string; message: string; value?: string }> = [];

  try {
    db.transaction(() => {
      for (const row of preview.preview) {
        if (!row.valid) continue;

        try {
          createTransaction({
            accountId,
            amount: row.amount,
            type: row.type as "income" | "expense" | "transfer",
            currency: row.currency,
            date: row.date,
            status: "cleared",
            description: row.description || undefined,
            category: row.category || undefined,
            note: row.note || undefined,
          });
          importedCount++;
        } catch (err) {
          rowErrors.push({
            row: row.row,
            field: "system",
            message: `导入失败: ${(err as Error).message}`,
            value: JSON.stringify(row),
          });
        }
      }
    });

    // 4. 导入后完整性检查
    const integrityIssues = checkAccountIntegrity(accountId);

    // 5. 更新任务状态
    const allErrors = [...preview.errors, ...rowErrors];
    db.update(importJobs)
      .set({
        status: "completed",
        importedRows: importedCount,
        errorRows: allErrors.length,
        progress: 100,
        errors: JSON.stringify(allErrors),
        summary: JSON.stringify({
          message: `成功导入 ${importedCount} 条，失败 ${allErrors.length} 条`,
          integrityCheck:
            integrityIssues.length === 0 ? "通过" : `发现 ${integrityIssues.length} 个问题`,
          integrityIssues: integrityIssues.length > 0 ? integrityIssues : undefined,
        }),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(importJobs.id, jobId))
      .run();

    return {
      ...preview,
      jobId,
      importedRows: importedCount,
      errors: allErrors,
      errorRows: allErrors.length,
    };
  } catch (err) {
    // 事务级失败
    db.update(importJobs)
      .set({
        status: "failed",
        progress: 0,
        summary: JSON.stringify({ error: (err as Error).message }),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(importJobs.id, jobId))
      .run();

    throw new DomainError("import_error", `导入事务失败: ${(err as Error).message}`);
  }
}

// ── 异步导入支持 ──

/**
 * 创建待处理的导入任务（不立即执行）。
 * 返回 jobId，Worker 会异步处理。
 */
export function queueImportJob(
  csvText: string,
  accountId: string,
  mapping?: ImportFieldMapping,
): string {
  const db = getDb();
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();

  // 快速预览以获取统计信息
  const preview = previewTransactionImport(csvText, accountId, mapping);

  db.insert(importJobs)
    .values({
      id: jobId,
      entityType: "transactions",
      status: "pending",
      fileName: undefined,
      params: JSON.stringify({ csv: csvText, accountId, mapping }),
      totalRows: preview.totalRows,
      validRows: preview.validRows,
      errorRows: preview.errorRows,
      duplicateRows: preview.duplicateRows,
      importedRows: 0,
      progress: 0,
      errors: JSON.stringify(preview.errors),
      summary: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return jobId;
}

/**
 * 执行一个已排队的导入任务（供 Worker 调用）。
 * 更新任务状态和进度。
 */
export function executeImportJob(jobId: string): void {
  const db = getDb();

  // 获取任务
  const job = db.select().from(importJobs).where(eq(importJobs.id, jobId)).get();
  if (!job) {
    throw new DomainError("not_found", `导入任务 ${jobId} 不存在`);
  }
  if (job.status !== "pending") {
    throw new DomainError("conflict", `任务 ${jobId} 状态为 ${job.status}，无法执行`);
  }

  // 解析参数
  let params: { csv: string; accountId: string; mapping?: ImportFieldMapping };
  try {
    params = JSON.parse(job.params ?? "{}") as {
      csv: string;
      accountId: string;
      mapping?: ImportFieldMapping;
    };
  } catch {
    db.update(importJobs)
      .set({
        status: "failed",
        summary: JSON.stringify({ error: "无法解析任务参数" }),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(importJobs.id, jobId))
      .run();
    return;
  }

  // 标记为运行中
  const now = new Date().toISOString();
  db.update(importJobs)
    .set({ status: "running", startedAt: now, updatedAt: now })
    .where(eq(importJobs.id, jobId))
    .run();

  try {
    // 预览
    const preview = previewTransactionImport(params.csv, params.accountId, params.mapping);

    // 更新进度：预览完成 10%
    db.update(importJobs)
      .set({
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        errorRows: preview.errorRows,
        duplicateRows: preview.duplicateRows,
        progress: 10,
        errors: JSON.stringify(preview.errors),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(importJobs.id, jobId))
      .run();

    if (preview.validRows === 0) {
      db.update(importJobs)
        .set({
          status: "completed",
          importedRows: 0,
          progress: 100,
          summary: JSON.stringify({ message: "没有有效的行可导入" }),
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(importJobs.id, jobId))
        .run();
      return;
    }

    // 逐批导入并更新进度
    const validRows = preview.preview.filter((r) => r.valid);
    const total = validRows.length;
    let importedCount = 0;
    const rowErrors: Array<{ row: number; field: string; message: string; value?: string }> = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]!;

      try {
        db.transaction(() => {
          createTransaction({
            accountId: params.accountId,
            amount: row.amount,
            type: row.type as "income" | "expense" | "transfer",
            currency: row.currency,
            date: row.date,
            status: "cleared",
            description: row.description || undefined,
            category: row.category || undefined,
            note: row.note || undefined,
          });
        });
        importedCount++;
      } catch (err) {
        rowErrors.push({
          row: row.row,
          field: "system",
          message: `导入失败: ${(err as Error).message}`,
          value: JSON.stringify(row),
        });
      }

      // 每 10 行或最后一行更新进度
      if (i % 10 === 0 || i === total - 1) {
        const progress = Math.min(10 + Math.round(((i + 1) / total) * 80), 90);
        db.update(importJobs)
          .set({
            importedRows: importedCount,
            progress,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(importJobs.id, jobId))
          .run();
      }
    }

    // 完整性检查
    const integrityIssues = checkAccountIntegrity(params.accountId);

    // 完成
    const allErrors = [...preview.errors, ...rowErrors];
    db.update(importJobs)
      .set({
        status: "completed",
        importedRows: importedCount,
        errorRows: allErrors.length,
        progress: 100,
        errors: JSON.stringify(allErrors),
        summary: JSON.stringify({
          message: `成功导入 ${importedCount} 条，失败 ${allErrors.length} 条`,
          integrityCheck:
            integrityIssues.length === 0 ? "通过" : `发现 ${integrityIssues.length} 个问题`,
          integrityIssues: integrityIssues.length > 0 ? integrityIssues : undefined,
        }),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(importJobs.id, jobId))
      .run();
  } catch (err) {
    db.update(importJobs)
      .set({
        status: "failed",
        progress: 0,
        summary: JSON.stringify({ error: (err as Error).message }),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(importJobs.id, jobId))
      .run();
  }
}

// ── 导入历史查询 ──

export function listImportJobs(limit = 20, offset = 0) {
  const db = getDb();
  return db
    .select()
    .from(importJobs)
    .orderBy(importJobs.createdAt)
    .limit(limit)
    .offset(offset)
    .all();
}

export function getImportJob(id: string) {
  const db = getDb();
  const job = db.select().from(importJobs).where(eq(importJobs.id, id)).get();
  if (!job) {
    throw new DomainError("not_found", `导入任务 ${id} 不存在`);
  }
  return job;
}

/**
 * 获取待处理的任务列表（供 Worker 轮询使用）。
 */
export function getPendingImportJobs(limit = 5) {
  const db = getDb();
  return db.select().from(importJobs).where(eq(importJobs.status, "pending")).limit(limit).all();
}

// ── 内部工具 ──

const TYPE_ALIASES: Record<string, string> = {
  income: "income",
  收入: "income",
  收款: "income",
  in: "income",
  deposit: "income",
  expense: "expense",
  支出: "expense",
  付款: "expense",
  消费: "expense",
  out: "expense",
  withdrawal: "expense",
  transfer: "transfer",
  转账: "transfer",
};

function normalizeType(value: string): "income" | "expense" | "transfer" | null {
  const cleaned = value.trim().toLowerCase();
  const mapped = TYPE_ALIASES[cleaned];
  if (mapped === "income" || mapped === "expense" || mapped === "transfer") return mapped;
  return null;
}
