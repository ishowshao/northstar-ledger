import { zValidator } from "@hono/zod-validator";
import {
  executeTransactionImport,
  getImportJob,
  listImportJobs,
  previewTransactionImport,
} from "@northstar/domain";
import { DomainError } from "@northstar/shared";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

// ── Preview Import ──
// POST /api/v1/import/preview
// Body: { csv: string, accountId: string, mapping?: ImportFieldMapping }

const PreviewSchema = z.object({
  csv: z.string().min(1, "CSV 内容不能为空"),
  accountId: z.string().uuid("账户 ID 格式无效"),
  mapping: z
    .object({
      date: z.string().optional(),
      amount: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
});

router.post("/preview", zValidator("json", PreviewSchema), (c) => {
  const { csv, accountId, mapping } = c.req.valid("json");
  const result = previewTransactionImport(csv, accountId, mapping);
  return c.json({ data: result });
});

// ── Execute Import ──
// POST /api/v1/import/execute
// Body: { csv: string, accountId: string, mapping?: ImportFieldMapping }

const ExecuteSchema = z.object({
  csv: z.string().min(1, "CSV 内容不能为空"),
  accountId: z.string().uuid("账户 ID 格式无效"),
  mapping: z
    .object({
      date: z.string().optional(),
      amount: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
});

router.post("/execute", zValidator("json", ExecuteSchema), (c) => {
  const { csv, accountId, mapping } = c.req.valid("json");
  try {
    const result = executeTransactionImport(csv, accountId, mapping);
    return c.json({ data: result }, 201);
  } catch (e) {
    if (e instanceof DomainError) {
      return c.json({ error: e.message }, 400);
    }
    throw e;
  }
});

// ── List Import Jobs ──
// GET /api/v1/import/jobs?limit=20&offset=0

const ListJobsSchema = z.object({
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/jobs", zValidator("query", ListJobsSchema), (c) => {
  const { limit, offset } = c.req.valid("query");
  const items = listImportJobs(limit, offset);
  return c.json({ data: items, meta: { total: items.length, limit, offset } });
});

// ── Get Import Job ──
// GET /api/v1/import/jobs/:id

router.get("/jobs/:id", (c) => {
  try {
    const job = getImportJob(c.req.param("id"));
    return c.json({ data: job });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

export { router as importRoutes };
