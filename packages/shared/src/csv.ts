import type { CurrencyCode } from "@northstar/shared";

// ── 解析配置 ──

export interface CsvParseOptions {
  /** 列分隔符，默认逗号 */
  delimiter?: string;
  /** 是否跳过首行（表头），默认 true */
  hasHeader?: boolean;
  /** 日期格式，支持 YYYY-MM-DD、YYYY/MM/DD、DD/MM/YYYY、MM/DD/YYYY */
  dateFormat?: string;
  /** 金额千分位分隔符，默认移除 */
  removeThousandsSeparator?: boolean;
  /** 字符编码，默认 utf-8 */
  encoding?: string;
}

export interface CsvRow {
  /** 原始行号（1-based，含表头） */
  rowNumber: number;
  /** 解析后的键值对 */
  fields: Record<string, string>;
}

export interface CsvParseResult {
  rows: CsvRow[];
  headers: string[];
  totalRows: number;
}

// ── 行级错误 ──

export interface RowError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

// ── 解析函数 ──

/**
 * 解析 CSV 文本，返回结构化行数据。
 * 支持基本 CSV 格式（不含引号内换行等复杂场景）。
 */
export function parseCsv(text: string, options: CsvParseOptions = {}): CsvParseResult {
  const { delimiter = ",", hasHeader = true } = options;

  const lines = splitLines(text);
  if (lines.length === 0) {
    return { rows: [], headers: [], totalRows: 0 };
  }

  const headers = hasHeader ? parseLine(lines[0] as string, delimiter) : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: CsvRow[] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]?.trim();
    if (!line) continue;

    const values = parseLine(line, delimiter);
    const fields: Record<string, string> = {};

    if (hasHeader) {
      for (let j = 0; j < headers.length; j++) {
        fields[headers[j] as string] = values[j] ?? "";
      }
    } else {
      for (let j = 0; j < values.length; j++) {
        fields[`col${j + 1}`] = values[j] ?? "";
      }
    }

    rows.push({
      rowNumber: hasHeader ? i + 2 : i + 1,
      fields,
    });
  }

  return { rows, headers, totalRows: rows.length };
}

// ── 字段值转换工具 ──

/**
 * 尝试将字符串解析为整数金额（最小货币单位）。
 * 支持格式: "1234.56"（元/元→分）、"1,234.56"、"1234"（已是分单位）、"-1234"
 *
 * 规则：
 * - 含小数点时：解析为元/主单位，乘以 10^decimals 转为分/最小单位
 * - 不含小数点时：直接作为最小单位整数
 */
export function parseAmount(value: string, decimals = 2): number | null {
  let cleaned = value.trim();

  // 处理负号
  const negative = cleaned.startsWith("-");
  if (negative) cleaned = cleaned.slice(1);

  // 移除非数字字符（保留小数点）
  cleaned = cleaned.replace(/[^\d.]/g, "");

  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return null;

  // 不包含小数点时，直接作为最小单位整数
  if (!cleaned.includes(".")) {
    const int = Number.parseInt(cleaned, 10);
    if (Number.isNaN(int)) return null;
    return negative ? -int : int;
  }

  // 包含小数点时，乘 10^decimals
  const integer = Math.round(num * 10 ** decimals);
  return negative ? -integer : integer;
}

/**
 * 尝试将字符串解析为日期，返回 YYYY-MM-DD 格式。
 */
export function parseDate(value: string, _format?: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  // 已经是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // YYYY/MM/DD
  const m1 = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m1) return `${m1[1]}-${m1[2]?.padStart(2, "0")}-${m1[3]?.padStart(2, "0")}`;

  // DD/MM/YYYY
  const m2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2]?.padStart(2, "0")}-${m2[1]?.padStart(2, "0")}`;

  // MM/DD/YYYY
  const m3 = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[1]?.padStart(2, "0")}-${m3[2]?.padStart(2, "0")}`;

  // 尝试 Date.parse
  const d = new Date(cleaned);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * 尝试解析币种代码。
 */
export function parseCurrency(value: string): CurrencyCode | null {
  const cleaned = value.trim().toUpperCase();
  const valid = ["CNY", "USD", "EUR", "JPY", "GBP"];
  if (valid.includes(cleaned)) return cleaned as CurrencyCode;
  return null;
}

// ── 内部工具 ──

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;

    if (ch === '"') {
      // 处理转义引号 ""
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());

  return result;
}
