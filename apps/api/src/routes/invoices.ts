import { zValidator } from "@hono/zod-validator";
import {
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  cancelInvoice,
  createInvoice,
  deleteInvoice,
  exportInvoiceHtml,
  getInvoice,
  getInvoiceByNumber,
  listInvoices,
  markInvoiceOverdue,
  markInvoicePaid,
  markInvoiceSent,
  updateInvoice,
} from "@northstar/domain";
import { DomainError } from "@northstar/shared";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

// GET /api/v1/invoices
router.get("/", (c) => {
  const items = listInvoices();
  return c.json({ data: items });
});

// GET /api/v1/invoices/:id
router.get("/:id", (c) => {
  try {
    const item = getInvoice(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

// GET /api/v1/invoices/number/:number
router.get("/number/:number", (c) => {
  try {
    const item = getInvoiceByNumber(c.req.param("number"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

// POST /api/v1/invoices
router.post("/", zValidator("json", CreateInvoiceSchema), (c) => {
  const input = c.req.valid("json");
  const item = createInvoice(input);
  return c.json({ data: item }, 201);
});

// PATCH /api/v1/invoices/:id
router.patch("/:id", zValidator("json", UpdateInvoiceSchema), (c) => {
  const input = c.req.valid("json");
  try {
    const item = updateInvoice(c.req.param("id"), input);
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.category === "not_found" ? 404 : 409;
      return c.json({ error: e.message }, status);
    }
    throw e;
  }
});

// DELETE /api/v1/invoices/:id
router.delete("/:id", (c) => {
  try {
    deleteInvoice(c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

// ── Status Transitions ──

const StatusParamSchema = z.object({
  id: z.string().uuid(),
});

// POST /api/v1/invoices/:id/send
router.post("/:id/send", zValidator("param", StatusParamSchema), (c) => {
  try {
    const item = markInvoiceSent(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.category === "not_found" ? 404 : 409;
      return c.json({ error: e.message }, status);
    }
    throw e;
  }
});

// POST /api/v1/invoices/:id/pay
router.post("/:id/pay", zValidator("param", StatusParamSchema), (c) => {
  try {
    const item = markInvoicePaid(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.category === "not_found" ? 404 : 409;
      return c.json({ error: e.message }, status);
    }
    throw e;
  }
});

// POST /api/v1/invoices/:id/overdue
router.post("/:id/overdue", zValidator("param", StatusParamSchema), (c) => {
  try {
    const item = markInvoiceOverdue(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.category === "not_found" ? 404 : 409;
      return c.json({ error: e.message }, status);
    }
    throw e;
  }
});

// POST /api/v1/invoices/:id/cancel
router.post("/:id/cancel", zValidator("param", StatusParamSchema), (c) => {
  try {
    const item = cancelInvoice(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError) {
      const status = e.category === "not_found" ? 404 : 409;
      return c.json({ error: e.message }, status);
    }
    throw e;
  }
});

// GET /api/v1/invoices/:id/export
router.get("/:id/export", (c) => {
  try {
    const html = exportInvoiceHtml(c.req.param("id"));
    return c.html(html);
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

export { router as invoicesRoutes };
