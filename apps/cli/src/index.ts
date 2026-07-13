#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import type { CreateProjectInput } from "@northstar/domain";
import {
  cancelInvoice,
  checkAccountIntegrity,
  createAccount,
  createCustomer,
  createInvoice,
  createProject,
  createTransaction,
  deleteAccount,
  deleteCustomer,
  deleteInvoice,
  deleteTransaction,
  executeTransactionImport,
  exportInvoiceHtml,
  getAccount,
  getCashFlow,
  getCustomerRevenue,
  getImportJob,
  getInvoice,
  getInvoiceByNumber,
  getMonthlySummary,
  getPeriodSummary,
  getProjectProfitability,
  getTransaction,
  listAccounts,
  listCustomers,
  listImportJobs,
  listInvoices,
  listProjects,
  listTransactions,
  markInvoiceOverdue,
  markInvoicePaid,
  markInvoiceSent,
  previewTransactionImport,
  queueImportJob,
  runIntegrityCheck,
} from "@northstar/domain";
import { Command } from "commander";
import pino from "pino";

const _log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: { target: "pino/file", options: { destination: 1 } },
});

const program = new Command();

program.name("northstar").description("Northstar Ledger — 本地财务与经营台账系统").version("0.0.1");

// ── 账户命令 ──

const accountCmd = program.command("accounts").alias("acct").description("管理账户");

accountCmd
  .command("list")
  .description("列出所有账户")
  .action(() => {
    const items = listAccounts();
    if (items.length === 0) {
      console.log("暂无账户");
      return;
    }
    console.table(
      items.map((a) => ({
        ID: a.id.slice(0, 8),
        名称: a.name,
        类型: a.type,
        币种: a.currency,
        余额: a.balance,
        状态: a.isActive ? "启用" : "停用",
      })),
    );
  });

accountCmd
  .command("create")
  .description("创建账户")
  .requiredOption("--name <name>", "账户名称")
  .option("--type <type>", "类型: cash|bank|credit|investment|other", "bank")
  .option("--currency <code>", "币种代码", "CNY")
  .option("--description <text>", "描述")
  .action((options) => {
    const item = createAccount({
      name: options.name,
      type: options.type,
      currency: options.currency,
      description: options.description,
    });
    console.log(`✅ 账户创建成功: ${item.name} (${item.id.slice(0, 8)})`);
  });

accountCmd
  .command("get")
  .description("查看账户详情")
  .requiredOption("--id <id>", "账户 ID")
  .action((options) => {
    const item = getAccount(options.id);
    console.log(JSON.stringify(item, null, 2));
  });

accountCmd
  .command("delete")
  .description("删除账户")
  .requiredOption("--id <id>", "账户 ID")
  .action((options) => {
    deleteAccount(options.id);
    console.log("✅ 账户已删除");
  });

// ── 客户命令 ──

const customerCmd = program.command("customers").alias("cust").description("管理客户");

customerCmd
  .command("list")
  .description("列出所有客户")
  .action(() => {
    const items = listCustomers();
    if (items.length === 0) {
      console.log("暂无客户");
      return;
    }
    console.table(
      items.map((c) => ({
        ID: c.id.slice(0, 8),
        名称: c.name,
        邮箱: c.email ?? "-",
        电话: c.phone ?? "-",
      })),
    );
  });

customerCmd
  .command("create")
  .description("创建客户")
  .requiredOption("--name <name>", "客户名称")
  .option("--email <email>", "邮箱")
  .option("--phone <phone>", "电话")
  .option("--notes <text>", "备注")
  .action((options) => {
    const item = createCustomer({
      name: options.name,
      email: options.email,
      phone: options.phone,
      notes: options.notes,
    });
    console.log(`✅ 客户创建成功: ${item.name} (${item.id.slice(0, 8)})`);
  });

customerCmd
  .command("delete")
  .description("删除客户")
  .requiredOption("--id <id>", "客户 ID")
  .action((options) => {
    deleteCustomer(options.id);
    console.log("✅ 客户已删除");
  });

// ── 项目命令 ──

const projectCmd = program.command("projects").alias("proj").description("管理项目");

projectCmd
  .command("list")
  .description("列出所有项目")
  .action(() => {
    const items = listProjects();
    if (items.length === 0) {
      console.log("暂无项目");
      return;
    }
    console.table(
      items.map((p) => ({
        ID: p.id.slice(0, 8),
        名称: p.name,
        状态: p.status,
        客户: p.customerId?.slice(0, 8) ?? "-",
      })),
    );
  });

projectCmd
  .command("create")
  .description("创建项目")
  .requiredOption("--name <name>", "项目名称")
  .option("--customer-id <id>", "客户 ID")
  .option("--status <status>", "状态: active|completed|cancelled", "active")
  .option("--hourly-rate <number>", "时薪（最小单位整数）")
  .action((options) => {
    const input = { name: options.name, status: options.status };
    if (options.customerId) (input as Record<string, unknown>).customerId = options.customerId;
    if (options.hourlyRate)
      (input as Record<string, unknown>).hourlyRate = Number.parseInt(options.hourlyRate, 10);
    const item = createProject(input as CreateProjectInput);
    console.log(`✅ 项目创建成功: ${item.name} (${item.id.slice(0, 8)})`);
  });

// ── 交易命令 ──

const txCmd = program.command("transactions").alias("tx").description("管理交易记录");

txCmd
  .command("list")
  .description("列出交易记录")
  .option("--limit <number>", "限制条数", "20")
  .option("--offset <number>", "偏移量", "0")
  .option("--account-id <id>", "按账户筛选")
  .option("--type <type>", "按类型筛选: income|expense|transfer")
  .option("--date-from <date>", "起始日期 YYYY-MM-DD")
  .option("--date-to <date>", "结束日期 YYYY-MM-DD")
  .action((options) => {
    const filters: Record<string, unknown> = {};
    if (options.limit) filters.limit = Number.parseInt(options.limit, 10);
    if (options.offset) filters.offset = Number.parseInt(options.offset, 10);
    if (options.accountId) filters.accountId = options.accountId;
    if (options.type) filters.type = options.type;
    if (options.dateFrom) filters.dateFrom = options.dateFrom;
    if (options.dateTo) filters.dateTo = options.dateTo;

    const items = listTransactions(filters);
    if (items.length === 0) {
      console.log("暂无交易记录");
      return;
    }
    console.table(
      items.map((t) => ({
        ID: t.id.slice(0, 8),
        日期: t.date,
        类型: t.type === "income" ? "收入" : t.type === "expense" ? "支出" : "转账",
        金额: t.type === "income" ? `+${t.amount}` : `-${t.amount}`,
        描述: t.description ?? "-",
        状态: t.status,
      })),
    );
  });

txCmd
  .command("add")
  .description("新增交易")
  .requiredOption("--account <id>", "账户 ID")
  .requiredOption("--amount <number>", "金额（最小单位整数）")
  .requiredOption("--type <type>", "类型: income|expense|transfer")
  .option("--description <text>", "描述")
  .option("--category <category>", "分类")
  .option("--date <date>", "日期 (YYYY-MM-DD)")
  .option("--customer-id <id>", "客户 ID")
  .option("--project-id <id>", "项目 ID")
  .option("--note <text>", "备注")
  .action(async (options) => {
    const input = {
      accountId: options.account,
      amount: Number.parseInt(options.amount, 10),
      type: options.type,
      currency: "CNY",
      status: "cleared" as const,
      description: options.description,
      category: options.category,
      date: options.date ?? new Date().toISOString().slice(0, 10),
      customerId: options.customerId,
      projectId: options.projectId,
      note: options.note,
    };

    try {
      const item = createTransaction(input);
      console.log(`✅ 交易创建成功 (${item.id.slice(0, 8)})`);
    } catch (e) {
      console.error("❌ 创建失败:", (e as Error).message);
      process.exit(1);
    }
  });

txCmd
  .command("get")
  .description("查看交易详情")
  .requiredOption("--id <id>", "交易 ID")
  .action((options) => {
    const item = getTransaction(options.id);
    console.log(JSON.stringify(item, null, 2));
  });

txCmd
  .command("delete")
  .description("删除交易")
  .requiredOption("--id <id>", "交易 ID")
  .action((options) => {
    deleteTransaction(options.id);
    console.log("✅ 交易已删除");
  });

// ── 汇总命令 ──

program
  .command("summary")
  .description("查看经营汇总")
  .option("--period <period>", "周期: monthly|yearly", "monthly")
  .option("--year <year>")
  .option("--month <month>")
  .action((options) => {
    const year = Number.parseInt(options.year ?? String(new Date().getFullYear()), 10);
    const month = options.month ? Number.parseInt(options.month, 10) : undefined;

    if (options.period === "monthly") {
      const items = getMonthlySummary(year, month);
      if (items.length === 0) {
        console.log("该周期暂无数据");
        return;
      }
      console.table(
        items.map((s) => ({
          年月: `${s.year}-${String(s.month).padStart(2, "0")}`,
          收入: s.income,
          支出: s.expense,
          净结余: s.net,
          交易数: s.txCount,
        })),
      );
    } else if (options.period === "yearly") {
      const data = getPeriodSummary(`${year}-01-01`, `${year}-12-31`);
      console.log(`\n📊 ${year}年度汇总`);
      console.log(`  总收入: ${data.totalIncome}`);
      console.log(`  总支出: ${data.totalExpense}`);
      console.log(`  净结余: ${data.netIncome}`);
      console.log(`  交易数: ${data.txCount}\n`);
    }
  });

// ── 导入命令 ──

const importCmd = program.command("import").description("CSV 数据导入");

importCmd
  .command("preview")
  .description("预览 CSV 导入结果（不写入数据库）")
  .requiredOption("--file <path>", "CSV 文件路径")
  .requiredOption("--account-id <id>", "目标账户 ID")
  .action((options) => {
    if (!existsSync(options.file)) {
      console.error("❌ 文件不存在:", options.file);
      process.exit(1);
    }
    const csv = readFileSync(options.file, "utf-8");
    const result = previewTransactionImport(csv, options.accountId);
    console.log("\n📋 导入预览");
    console.log(`  总行数: ${result.totalRows}`);
    console.log(`  有效行: ${result.validRows}`);
    console.log(`  错误行: ${result.errorRows}`);
    console.log(`  重复行: ${result.duplicateRows}\n`);

    if (result.errors.length > 0) {
      console.log("⚠️  错误明细:");
      for (const err of result.errors.slice(0, 10)) {
        console.log(
          `  行 ${err.row} | ${err.field}: ${err.message}${err.value ? ` (值: ${err.value})` : ""}`,
        );
      }
      if (result.errors.length > 10) {
        console.log(`  ... 还有 ${result.errors.length - 10} 条错误`);
      }
    }

    if (result.preview.length > 0) {
      console.log("📄 预览（前 10 条）:");
      console.table(
        result.preview.slice(0, 10).map((r) => ({
          行: r.row,
          类型: r.type,
          金额: r.amount,
          币种: r.currency,
          日期: r.date,
          描述: r.description,
          状态: r.valid ? "✅" : "❌",
        })),
      );
    }
  });

// ── 同步导入 ──

importCmd
  .command("execute")
  .description("同步执行 CSV 导入（适合小文件）")
  .requiredOption("--file <path>", "CSV 文件路径")
  .requiredOption("--account-id <id>", "目标账户 ID")
  .action((options) => {
    if (!existsSync(options.file)) {
      console.error("❌ 文件不存在:", options.file);
      process.exit(1);
    }
    const csv = readFileSync(options.file, "utf-8");
    console.log("⏳ 正在导入...");
    try {
      const result = executeTransactionImport(csv, options.accountId);
      console.log("\n✅ 导入完成");
      console.log(`  导入任务 ID: ${result.jobId.slice(0, 8)}...`);
      console.log(`  成功导入: ${result.importedRows}`);
      console.log(`  总行数: ${result.totalRows}`);
      console.log(`  有效行: ${result.validRows}`);
      console.log(`  错误行: ${result.errorRows}`);
      console.log(`  重复行: ${result.duplicateRows}\n`);
      if (result.errors.length > 0) {
        console.log("⚠️  错误明细:");
        for (const err of result.errors.slice(0, 10)) {
          console.log(`  行 ${err.row} | ${err.field}: ${err.message}`);
        }
        if (result.errors.length > 10) {
          console.log(`  ... 还有 ${result.errors.length - 10} 条错误`);
        }
      }
    } catch (e) {
      console.error("❌ 导入失败:", (e as Error).message);
      process.exit(1);
    }
  });

// ── 异步导入（排入队列，由 Worker 处理） ──

importCmd
  .command("queue")
  .description("异步提交 CSV 导入任务（适合大文件，需要 Worker 运行）")
  .requiredOption("--file <path>", "CSV 文件路径")
  .requiredOption("--account-id <id>", "目标账户 ID")
  .action((options) => {
    if (!existsSync(options.file)) {
      console.error("❌ 文件不存在:", options.file);
      process.exit(1);
    }
    const csv = readFileSync(options.file, "utf-8");
    console.log("⏳ 正在提交导入任务...");
    try {
      const jobId = queueImportJob(csv, options.accountId);
      console.log("\n✅ 导入任务已提交");
      console.log(`  任务 ID: ${jobId}`);
      console.log("  状态: pending");
      console.log("\n使用以下命令查看进度:");
      console.log(`  northstar import job --id ${jobId}`);
      console.log(`  northstar import job-status --id ${jobId}\n`);
    } catch (e) {
      console.error("❌ 提交失败:", (e as Error).message);
      process.exit(1);
    }
  });

// ── 任务状态（精简版） ──

importCmd
  .command("job-status")
  .description("查看导入任务状态（精简进度）")
  .requiredOption("--id <id>", "任务 ID")
  .action((options) => {
    try {
      const job = getImportJob(options.id);
      console.log("\n📊 导入任务状态");
      console.log(`  任务 ID: ${job.id}`);
      console.log(
        `  状态: ${job.status === "pending" ? "⏳ 等待中" : job.status === "running" ? "🔄 运行中" : job.status === "completed" ? "✅ 已完成" : job.status === "failed" ? "❌ 失败" : job.status}`,
      );
      console.log(`  进度: ${job.progress}%`);
      console.log(`  总行: ${job.totalRows}`);
      console.log(`  已导入: ${job.importedRows}`);
      console.log(`  错误: ${job.errorRows}`);
      console.log(`  重复: ${job.duplicateRows}`);
      if (job.summary) {
        try {
          const summary = JSON.parse(job.summary);
          console.log(`  摘要: ${summary.message ?? summary.error ?? ""}`);
        } catch {
          /* ignore */
        }
      }
      if (job.completedAt) {
        console.log(`  完成时间: ${job.completedAt}`);
      }
      console.log();
    } catch (e) {
      if ((e as Error).message.includes("不存在")) {
        console.error("❌ 任务不存在:", options.id);
        process.exit(1);
      }
      throw e;
    }
  });

// ── 导入任务列表 ──

importCmd
  .command("jobs")
  .description("列出所有导入任务")
  .option("--limit <number>", "限制条数", "20")
  .option("--offset <number>", "偏移量", "0")
  .action((options) => {
    const items = listImportJobs(
      Number.parseInt(options.limit, 10),
      Number.parseInt(options.offset, 10),
    );
    if (items.length === 0) {
      console.log("暂无导入任务");
      return;
    }
    console.table(
      items.map((j) => ({
        ID: j.id.slice(0, 8),
        类型: j.entityType,
        状态: `${j.status === "pending" ? "⏳" : j.status === "running" ? "🔄" : j.status === "completed" ? "✅" : j.status === "failed" ? "❌" : "⬜"} ${j.status}`,
        进度: `${j.progress}%`,
        总行: j.totalRows,
        成功: j.importedRows,
        错误: j.errorRows,
        重复: j.duplicateRows,
      })),
    );
  });

importCmd
  .command("job")
  .description("查看导入任务详情（完整 JSON）")
  .requiredOption("--id <id>", "任务 ID")
  .action((options) => {
    try {
      const job = getImportJob(options.id);
      console.log(JSON.stringify(job, null, 2));
    } catch (e) {
      if ((e as Error).message.includes("不存在")) {
        console.error("❌ 任务不存在:", options.id);
        process.exit(1);
      }
      throw e;
    }
  });

// ── 完整性检查命令 ──

const integrityCmd = program.command("integrity").description("数据完整性检查");

integrityCmd
  .command("check")
  .description("检查全库数据完整性（余额一致性、外键引用等）")
  .action(() => {
    console.log("🔍 正在执行全库完整性检查...");
    const report = runIntegrityCheck();

    if (report.totalIssues === 0) {
      console.log("\n✅ 数据完整性检查通过，未发现问题\n");
      return;
    }

    console.log(`\n⚠️  发现 ${report.totalIssues} 个问题:\n`);
    for (const issue of report.issues) {
      const icon =
        issue.category === "balance_mismatch"
          ? "💰"
          : issue.category === "orphan_transaction"
            ? "🔗"
            : "⚠️";
      console.log(`  ${icon} [${issue.category}] ${issue.message}`);
      if (issue.detail) {
        console.log(`     详情: ${issue.detail}`);
      }
    }
    console.log();
  });

integrityCmd
  .command("account")
  .description("检查指定账户的完整性")
  .requiredOption("--id <id>", "账户 ID")
  .action((options) => {
    console.log(`🔍 正在检查账户 ${options.id.slice(0, 8)}...`);
    const issues = checkAccountIntegrity(options.id);

    if (issues.length === 0) {
      console.log("\n✅ 账户完整性检查通过\n");
      return;
    }

    console.log(`\n⚠️  发现 ${issues.length} 个问题:\n`);
    for (const issue of issues) {
      console.log(`  [${issue.category}] ${issue.message}`);
      if (issue.detail) {
        console.log(`     详情: ${issue.detail}`);
      }
    }
    console.log();
  });

// ── 发票命令 ──

const invoiceCmd = program.command("invoices").alias("inv").description("管理发票");

invoiceCmd
  .command("list")
  .description("列出所有发票")
  .action(() => {
    const items = listInvoices();
    if (items.length === 0) {
      console.log("暂无发票");
      return;
    }
    console.table(
      items.map((iv) => ({
        编号: iv.number,
        状态: iv.status,
        金额: `${(iv.totalAmount / 100).toFixed(2)} ${iv.currency}`,
        开票日期: iv.issueDate,
        到期日期: iv.dueDate,
      })),
    );
  });

invoiceCmd
  .command("create")
  .description("创建发票（含条目）")
  .requiredOption("--issue-date <date>", "开票日期 YYYY-MM-DD")
  .requiredOption("--due-date <date>", "到期日期 YYYY-MM-DD")
  .option("--customer-id <id>", "客户 ID")
  .option("--project-id <id>", "项目 ID")
  .option("--tax-rate <rate>", "税率百分比", "0")
  .option("--discount <amount>", "折扣金额（分）", "0")
  .option("--notes <text>", "备注")
  .option("--billing-name <name>", "发票抬头")
  .option("--items <json>", '条目 JSON, 如 [{"description":"咨询","quantity":1,"unitPrice":50000}]')
  .action((options) => {
    const items = options.items
      ? JSON.parse(options.items)
      : [{ description: "服务", quantity: 1, unitPrice: 0 }];
    const item = createInvoice({
      issueDate: options.issueDate,
      dueDate: options.dueDate,
      customerId: options.customerId,
      projectId: options.projectId,
      taxRate: Number.parseInt(options.taxRate, 10),
      discount: Number.parseInt(options.discount, 10),
      currency: "CNY",
      notes: options.notes,
      billingName: options.billingName,
      items,
    });
    console.log(`✅ 发票创建成功: ${item.invoice.number} (${item.invoice.id.slice(0, 8)})`);
    console.log(`   金额: ${(item.invoice.totalAmount / 100).toFixed(2)} ${item.invoice.currency}`);
  });

invoiceCmd
  .command("get")
  .description("查看发票详情")
  .requiredOption("--id <id>", "发票 ID")
  .action((options) => {
    try {
      const { invoice, items } = getInvoice(options.id);
      console.log(JSON.stringify({ invoice, items }, null, 2));
    } catch (e) {
      if ((e as Error).message.includes("不存在")) {
        console.error("❌ 发票不存在");
        process.exit(1);
      }
      throw e;
    }
  });

invoiceCmd
  .command("number")
  .description("按编号查看发票")
  .requiredOption("--number <number>", "发票编号")
  .action((options) => {
    try {
      const { invoice, items } = getInvoiceByNumber(options.number);
      console.log(JSON.stringify({ invoice, items }, null, 2));
    } catch (e) {
      if ((e as Error).message.includes("不存在")) {
        console.error("❌ 发票不存在");
        process.exit(1);
      }
      throw e;
    }
  });

invoiceCmd
  .command("send")
  .description("标记发票为已发送")
  .requiredOption("--id <id>", "发票 ID")
  .action((options) => {
    const item = markInvoiceSent(options.id);
    console.log(`✅ 发票 ${item.invoice.number} 已标记为已发送`);
  });

invoiceCmd
  .command("pay")
  .description("标记发票为已付款")
  .requiredOption("--id <id>", "发票 ID")
  .action((options) => {
    const item = markInvoicePaid(options.id);
    console.log(`✅ 发票 ${item.invoice.number} 已标记为已付款`);
  });

invoiceCmd
  .command("overdue")
  .description("标记发票为逾期")
  .requiredOption("--id <id>", "发票 ID")
  .action((options) => {
    const item = markInvoiceOverdue(options.id);
    console.log(`✅ 发票 ${item.invoice.number} 已标记为逾期`);
  });

invoiceCmd
  .command("cancel")
  .description("取消发票")
  .requiredOption("--id <id>", "发票 ID")
  .action((options) => {
    const item = cancelInvoice(options.id);
    console.log(`✅ 发票 ${item.invoice.number} 已取消`);
  });

invoiceCmd
  .command("delete")
  .description("删除发票")
  .requiredOption("--id <id>", "发票 ID")
  .action((options) => {
    deleteInvoice(options.id);
    console.log("✅ 发票已删除");
  });

invoiceCmd
  .command("export")
  .description("导出发票为 HTML")
  .requiredOption("--id <id>", "发票 ID")
  .action((options) => {
    try {
      const html = exportInvoiceHtml(options.id);
      const outPath = `invoice-${options.id.slice(0, 8)}.html`;
      Bun.write(outPath, html);
      console.log(`✅ 发票已导出到 ${outPath}`);
    } catch (e) {
      if ((e as Error).message.includes("不存在")) {
        console.error("❌ 发票不存在");
        process.exit(1);
      }
      throw e;
    }
  });

// ── 高级报表命令 ──

program
  .command("report")
  .description("经营报表")
  .option("--type <type>", "报表类型: projects|customers|cashflow", "projects")
  .option("--year <year>")
  .option("--date-from <date>")
  .option("--date-to <date>")
  .action((options) => {
    const type = options.type;

    if (type === "projects") {
      const data = getProjectProfitability(options.dateFrom, options.dateTo);
      if (data.length === 0) {
        console.log("暂无项目数据");
        return;
      }
      console.log("\n📊 项目盈利报表\n");
      console.table(
        data.map((p) => ({
          项目: p.projectName,
          收入: p.totalIncome,
          支出: p.totalExpense,
          利润: p.netProfit,
          发票金额: p.invoicedAmount,
          交易数: p.txCount,
        })),
      );
    } else if (type === "customers") {
      const data = getCustomerRevenue(options.dateFrom, options.dateTo);
      if (data.length === 0) {
        console.log("暂无客户数据");
        return;
      }
      console.log("\n📊 客户收入报表\n");
      console.table(
        data.map((c) => ({
          客户: c.customerName,
          收入: c.totalIncome,
          支出: c.totalExpense,
          净收入: c.netRevenue,
          发票数: c.invoiceCount,
          发票总额: c.invoiceTotal,
        })),
      );
    } else if (type === "cashflow") {
      const year = Number.parseInt(options.year ?? String(new Date().getFullYear()), 10);
      const data = getCashFlow(year);
      if (data.length === 0) {
        console.log("该年度暂无现金流数据");
        return;
      }
      console.log(`\n📊 ${year}年 现金流报表\n`);
      console.table(
        data.map((f) => ({
          月份: f.period,
          流入: f.inflow,
          流出: f.outflow,
          净流量: f.netFlow,
          期末余额: f.endingBalance,
        })),
      );
    }
  });

program.parse();
