import { getDb } from "@northstar/db";
import { executeImportJob, getPendingImportJobs, runIntegrityCheck } from "@northstar/domain";
import pino from "pino";

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

// ── 配置 ──

const CONFIG = {
  /** 轮询间隔（毫秒） */
  pollInterval: Number.parseInt(process.env.WORKER_POLL_INTERVAL ?? "5000", 10),
  /** 每次轮询最多获取的任务数 */
  maxJobsPerPoll: Number.parseInt(process.env.WORKER_MAX_JOBS ?? "5", 10),
  /** 完整性检查间隔（毫秒），默认每小时一次 */
  integrityCheckInterval: Number.parseInt(process.env.WORKER_INTEGRITY_INTERVAL ?? "3600000", 10),
};

// ── Worker ──

let running = true;
let lastIntegrityCheck = 0;

/**
 * Worker 主循环。
 * 1. 轮询待处理的导入任务
 * 2. 逐个执行
 * 3. 定期执行完整性检查
 */
async function workerLoop() {
  log.info({ config: CONFIG }, "Worker 启动");

  while (running) {
    try {
      // 1. 处理待处理的导入任务
      const pendingJobs = getPendingImportJobs(CONFIG.maxJobsPerPoll);

      if (pendingJobs.length > 0) {
        log.info({ count: pendingJobs.length }, "发现待处理的导入任务");

        for (const job of pendingJobs) {
          if (!running) break;

          log.info({ jobId: job.id, fileName: job.fileName }, "开始处理导入任务");

          try {
            executeImportJob(job.id);
            log.info({ jobId: job.id }, "导入任务完成");
          } catch (err) {
            log.error({ jobId: job.id, err }, "导入任务失败");
          }
        }
      }

      // 2. 定期完整性检查
      const now = Date.now();
      if (now - lastIntegrityCheck > CONFIG.integrityCheckInterval) {
        log.info("开始定期数据完整性检查");
        const report = runIntegrityCheck();
        lastIntegrityCheck = now;

        if (report.totalIssues > 0) {
          log.warn({ issues: report.totalIssues }, "数据完整性检查发现问题");
          for (const issue of report.issues) {
            log.warn({ issue }, `[${issue.category}] ${issue.message}`);
          }
        } else {
          log.info("数据完整性检查通过");
        }
      }

      // 3. 等待下次轮询
      await sleep(CONFIG.pollInterval);
    } catch (err) {
      log.error({ err }, "Worker 循环异常");
      await sleep(CONFIG.pollInterval);
    }
  }

  log.info("Worker 已停止");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 启动 ──

log.info("Northstar Ledger Worker 启动中...");

// 初始化数据库连接
getDb();

// 启动 Worker 循环（不阻塞进程退出）
workerLoop().catch((err) => {
  log.error({ err }, "Worker 异常退出");
  process.exit(1);
});

// ── 优雅关闭 ──

process.on("SIGINT", () => {
  log.info("收到 SIGINT，正在停止 Worker...");
  running = false;
  setTimeout(() => {
    log.info("Worker 已停止");
    process.exit(0);
  }, 2000);
});

process.on("SIGTERM", () => {
  log.info("收到 SIGTERM，正在停止 Worker...");
  running = false;
  setTimeout(() => {
    log.info("Worker 已停止");
    process.exit(0);
  }, 2000);
});

// 保持进程运行
log.info("Worker 已启动，等待任务...");
