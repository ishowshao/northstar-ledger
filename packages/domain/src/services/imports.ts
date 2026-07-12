import { getDb, importJobs } from "@northstar/db";
import { DomainError, parseAmount, parseCsv, parseDate } from "@northstar/shared";
import { eq } from "drizzle-orm";
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
 * 预览 CSV 导入结果（不写入数据库）。
 * 接收 CSV 文本、账户 ID、可选字段映射。
 */
export function previewTransactionImport(
  csvText: string,
  _accountId: string,
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
  let validCount = 0;
  const duplicateCount = 0;

  for (const row of parsed.rows) {
    const rowErrors: Array<{ row: number; field: string; message: string; value?: string }> = [];
    const fields = row.fields;

    // 日期
    const rawDate = fields[effectiveMapping.date];
    const date = parseDate(rawDate);

    // 金额
    const rawAmount = fields[effectiveMapping.amount];
    const amount = parseAmount(rawAmount);

    // 类型
    const rawType = fields[effectiveMapping.type];
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
    if (valid) validCount++;

    errors.push(...rowErrors);
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
      totalRows: preview.totalRows,
      validRows: preview.validRows,
      errorRows: preview.errorRows,
      duplicateRows: preview.duplicateRows,
      importedRows: 0,
      errors: JSON.stringify(preview.errors),
      summary: null,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (preview.validRows === 0) {
    // 无可导入行，标记完成
    db.update(importJobs)
      .set({
        status: "completed",
        importedRows: 0,
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

    // 4. 更新任务状态
    const allErrors = [...preview.errors, ...rowErrors];
    db.update(importJobs)
      .set({
        status: "completed",
        importedRows: importedCount,
        errorRows: allErrors.length,
        errors: JSON.stringify(allErrors),
        summary: JSON.stringify({
          message: `成功导入 ${importedCount} 条，失败 ${allErrors.length} 条`,
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
        summary: JSON.stringify({ error: (err as Error).message }),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(importJobs.id, jobId))
      .run();

    throw new DomainError("import_error", `导入事务失败: ${(err as Error).message}`);
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
