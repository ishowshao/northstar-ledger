import { zValidator } from "@hono/zod-validator";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "@northstar/domain";
import { DomainError } from "@northstar/shared";
import { Hono } from "hono";

const router = new Hono();

router.get("/", (c) => {
  const items = listProjects();
  return c.json({ data: items });
});

router.get("/:id", (c) => {
  try {
    const item = getProject(c.req.param("id"));
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.post("/", zValidator("json", CreateProjectSchema), (c) => {
  const input = c.req.valid("json");
  const item = createProject(input);
  return c.json({ data: item }, 201);
});

router.patch("/:id", zValidator("json", UpdateProjectSchema), (c) => {
  const input = c.req.valid("json");
  try {
    const item = updateProject(c.req.param("id"), input);
    return c.json({ data: item });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.delete("/:id", (c) => {
  try {
    deleteProject(c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    if (e instanceof DomainError && e.category === "not_found")
      return c.json({ error: e.message }, 404);
    throw e;
  }
});

export { router as projectsRoutes };
