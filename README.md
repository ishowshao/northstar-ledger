# Northstar Ledger

本地财务与经营台账系统 — 面向自由职业者和小型工作室。

## 项目结构

```
northstar-ledger/
├── packages/
│   ├── shared/     # 共享类型、工具函数与领域逻辑
│   └── db/         # 数据库 schema、迁移与查询
├── apps/
│   ├── api/        # Hono HTTP API 服务
│   ├── web/        # React + Vite 前端
│   └── cli/        # Commander.js CLI 工具
├── internal/
│   └── worker/     # 后台任务 Worker
├── scripts/        # 开发与运维脚本
└── docs/           # 项目文档
```

## 本地开发

### 前置要求

- [Bun](https://bun.sh/) >= 1.3

### 初始化

```bash
bun install
```

### 启动开发环境

```bash
# 同时启动 API 和 Web
bun dev

# 单独启动
bun dev:api     # API 服务 (http://localhost:3000)
bun dev:web     # Web 应用 (http://localhost:5173)
bun dev:cli     # CLI (watch 模式)
bun dev:worker  # 后台 Worker
```

### 数据库

```bash
bun db:push     # 推送 schema 到数据库
bun db:studio   # 打开 Drizzle Studio
bun db:migrate  # 运行迁移
```

### 代码质量

```bash
bun run check        # 类型检查 + lint + 测试
bun run typecheck    # TypeScript 类型检查
bun run lint         # Biome lint
bun run format       # Biome 格式化
bun run test:run     # 运行测试
```

## 技术栈

| 领域          | 选型                              |
|---------------|-----------------------------------|
| 语言/Runtime  | TypeScript + Bun                  |
| HTTP 框架     | Hono                              |
| 数据库        | SQLite + Drizzle ORM              |
| 前端          | React + Vite + TanStack Query     |
| CLI           | Commander.js                      |
| 数据校验      | Zod                               |
| 日志          | Pino                              |
| 格式化/Lint   | Biome                             |
