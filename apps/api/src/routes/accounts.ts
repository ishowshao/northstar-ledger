import { zValidator } from "@hono/zod-validator";
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from "@northstar/domain";
import { DomainError } from "@northstar/shared";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

// GET /api/v1/accounts
router.get("/", (c) => {
  const items = listAccounts();
  return c.json({ data: items });
});

// GET /api/v1/accounts/:id
router.get("/:id", (c) => {
  try {
    const item = getAccount(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

// POST /api/v1/accounts
router.post("/", zValidator("json", CreateAccountSchema), (c) => {
  const input = c.req.valid("json");
  const item = createAccount(input);
  return c.json({ data: item }, 201);
});

// PATCH /api/v1/accounts/:id
router.patch("/:id", zValidator("json", UpdateAccountSchema), (c) => {
  const input = c.req.valid("json");
  try {
    const item = updateAccount(c.req.param("id"), input);
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

// DELETE /api/v1/accounts/:id
router.delete("/:id", (c) => {
  try {
    deleteAccount(c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

export { router as accountsRoutes };
