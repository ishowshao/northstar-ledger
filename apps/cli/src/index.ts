#!/usr/bin/env bun
import type { CreateProjectInput } from "@northstar/domain";
import {
  createAccount,
  createCustomer,
  createProject,
  createTransaction,
  deleteAccount,
  deleteCustomer,
  deleteTransaction,
  getAccount,
  getMonthlySummary,
  getPeriodSummary,
  getTransaction,
  listAccounts,
  listCustomers,
  listProjects,
  listTransactions,
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

program.parse();
