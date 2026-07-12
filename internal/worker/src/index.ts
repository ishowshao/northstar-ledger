import pino from "pino";

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

log.info("Worker starting...");

// TODO: 实现后台任务队列与 Worker 循环
// - CSV 导入任务
// - 报表生成任务
// - 数据备份任务
// - 完整性检查任务

log.info("Worker started. Waiting for tasks...");

// 保持进程运行
setInterval(() => {
  // 心跳
}, 30_000);
