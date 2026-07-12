import { zValidator } from "@hono/zod-validator";
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "@northstar/domain";
import { DomainError } from "@northstar/shared";
import { Hono } from "hono";

const router = new Hono();

router.get("/", (c) => {
  const items = listCustomers();
  return c.json({ data: items });
});

router.get("/:id", (c) => {
  try {
    const item = getCustomer(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.post("/", zValidator("json", CreateCustomerSchema), (c) => {
  const input = c.req.valid("json");
  const item = createCustomer(input);
  return c.json({ data: item }, 201);
});

router.patch("/:id", zValidator("json", UpdateCustomerSchema), (c) => {
  const input = c.req.valid("json");
  try {
    const item = updateCustomer(c.req.param("id"), input);
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.delete("/:id", (c) => {
  try {
    deleteCustomer(c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

export { router as customersRoutes };
