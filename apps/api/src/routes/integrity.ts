import { zValidator } from "@hono/zod-validator";
import { checkAccountIntegrity, runIntegrityCheck } from "@northstar/domain";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

// GET /api/v1/integrity — 全库完整性检查
router.get("/", (c) => {
  const report = runIntegrityCheck();
  const status = report.totalIssues === 0 ? "ok" : "issues_found";
  return c.json({
    data: {
      status,
      checkedAt: report.checkedAt,
      totalIssues: report.totalIssues,
      issues: report.issues,
    },
  });
});

// GET /api/v1/integrity/accounts/:id — 单个账户完整性检查
router.get("/accounts/:id", (c) => {
  const issues = checkAccountIntegrity(c.req.param("id"));
  return c.json({
    data: {
      status: issues.length === 0 ? "ok" : "issues_found",
      issues,
    },
  });
});

export { router as integrityRoutes };
