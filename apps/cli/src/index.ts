#!/usr/bin/env bun
import { Command } from "commander";
import pino from "pino";

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: { target: "pino/file", options: { destination: 1 } },
});

const program = new Command();

program.name("northstar").description("Northstar Ledger — 本地财务与经营台账系统").version("0.0.1");

// ── 交易命令 ──

const tx = program.command("transactions").alias("tx").description("管理交易记录");

tx.command("list")
  .description("列出交易记录")
  .option("--limit <number>", "限制条数", "20")
  .option("--offset <number>", "偏移量", "0")
  .action(async (options) => {
    log.info({ limit: options.limit, offset: options.offset }, "列出交易");
    // TODO: 从数据库查询并输出
    console.log("交易列表 (待实现)");
  });

tx.command("add")
  .description("新增交易")
  .requiredOption("--account <id>", "账户 ID")
  .requiredOption("--amount <number>", "金额（最小单位整数）")
  .requiredOption("--type <type>", "类型: income|expense|transfer")
  .option("--description <text>", "描述")
  .option("--date <date>", "日期 (YYYY-MM-DD)")
  .action(async (options) => {
    log.info({ ...options }, "新增交易");
    // TODO: 调用业务逻辑创建交易
    console.log("交易创建成功 (待实现)");
  });

// ── 汇总命令 ──

program
  .command("summary")
  .description("查看月度/季度/年度经营汇总")
  .option("--period <period>", "周期: monthly|quarterly|yearly", "monthly")
  .option("--year <year>", "年份")
  .option("--month <month>", "月份 (1-12)")
  .action(async (options) => {
    log.info({ ...options }, "查看汇总");
    // TODO: 计算并输出汇总
    console.log("经营汇总 (待实现)");
  });

program.parse();
