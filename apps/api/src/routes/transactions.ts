import { zValidator } from "@hono/zod-validator";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  createTransaction,
  deleteTransaction,
  getTransaction,
  getTransactionCount,
  listTransactions,
  updateTransaction,
} from "@northstar/domain";
import { DomainError } from "@northstar/shared";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

// Query params schema
const ListQuerySchema = z.object({
  accountId: z.string().optional(),
  customerId: z.string().optional(),
  projectId: z.string().optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  status: z.enum(["pending", "cleared", "reconciled", "void"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/", zValidator("query", ListQuerySchema), (c) => {
  const filters = c.req.valid("query");
  const items = listTransactions(filters);
  const total = getTransactionCount(filters);
  return c.json({
    data: items,
    meta: { total, limit: filters.limit, offset: filters.offset },
  });
});

router.get("/:id", (c) => {
  try {
    const item = getTransaction(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.post("/", zValidator("json", CreateTransactionSchema), (c) => {
  const input = c.req.valid("json");
  try {
    const item = createTransaction(input);
    return c.json({ data: item }, 201);
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.category === "not_found" ? 404 : 400;
      return c.json({ error: e.message }, status);
    }
    throw e;
  }
});

router.patch("/:id", zValidator("json", UpdateTransactionSchema), (c) => {
  const input = c.req.valid("json");
  try {
    const item = updateTransaction(c.req.param("id"), input);
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.category === "not_found" ? 404 : 409;
      return c.json({ error: e.message }, status);
    }
    throw e;
  }
});

router.delete("/:id", (c) => {
  try {
    deleteTransaction(c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

export { router as transactionsRoutes };
