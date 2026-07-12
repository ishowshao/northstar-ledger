import { zValidator } from "@hono/zod-validator";
import {
  getCategoryBreakdown,
  getMonthlySummary,
  getPeriodSummary,
  getYearSummary,
} from "@northstar/domain";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

// GET /api/v1/summary/monthly?year=2024&month=1
router.get(
  "/monthly",
  zValidator(
    "query",
    z.object({
      year: z.coerce.number().int().min(2000).max(2100),
      month: z.coerce.number().int().min(1).max(12).optional(),
    }),
  ),
  (c) => {
    const { year, month } = c.req.valid("query");
    const data = getMonthlySummary(year, month);
    return c.json({ data });
  },
);

// GET /api/v1/summary/period?dateFrom=2024-01-01&dateTo=2024-12-31
router.get(
  "/period",
  zValidator(
    "query",
    z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
  (c) => {
    const { dateFrom, dateTo } = c.req.valid("query");
    const data = getPeriodSummary(dateFrom, dateTo);
    return c.json({ data });
  },
);

// GET /api/v1/summary/yearly?year=2024
router.get(
  "/yearly",
  zValidator(
    "query",
    z.object({
      year: z.coerce.number().int().min(2000).max(2100),
    }),
  ),
  (c) => {
    const { year } = c.req.valid("query");
    const data = getYearSummary(year);
    return c.json({ data });
  },
);

// GET /api/v1/summary/categories?dateFrom=2024-01-01&dateTo=2024-12-31
router.get(
  "/categories",
  zValidator(
    "query",
    z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
  (c) => {
    const { dateFrom, dateTo } = c.req.valid("query");
    const data = getCategoryBreakdown(dateFrom, dateTo);
    return c.json({ data });
  },
);

export { router as summaryRoutes };
