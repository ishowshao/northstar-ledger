import { getDb, projects } from "@northstar/db";
import { DomainError } from "@northstar/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ── Validation Schemas ──

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空"),
  description: z.string().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
  hourlyRate: z.number().int().positive().optional(),
  currency: z.string().length(3).default("CNY"),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// ── Service ──

export function listProjects() {
  const db = getDb();
  return db.select().from(projects).orderBy(projects.createdAt).all();
}

export function getProject(id: string) {
  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    throw new DomainError("not_found", `项目 ${id} 不存在`);
  }
  return project;
}

export function createProject(input: CreateProjectInput) {
  const parsed = CreateProjectSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();
  const id = crypto.randomUUID();
  db.insert(projects)
    .values({
      id,
      name: parsed.name,
      description: parsed.description ?? null,
      customerId: parsed.customerId ?? null,
      status: parsed.status,
      hourlyRate: parsed.hourlyRate ?? null,
      currency: parsed.currency,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getProject(id);
}

export function updateProject(id: string, input: UpdateProjectInput) {
  getProject(id);
  const parsed = UpdateProjectSchema.parse(input);
  const now = new Date().toISOString();
  const db = getDb();
  db.update(projects)
    .set({
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.description !== undefined && { description: parsed.description ?? null }),
      ...(parsed.customerId !== undefined && { customerId: parsed.customerId ?? null }),
      ...(parsed.status !== undefined && { status: parsed.status }),
      ...(parsed.hourlyRate !== undefined && { hourlyRate: parsed.hourlyRate ?? null }),
      ...(parsed.currency !== undefined && { currency: parsed.currency }),
      updatedAt: now,
    })
    .where(eq(projects.id, id))
    .run();
  return getProject(id);
}

export function deleteProject(id: string) {
  getProject(id);
  const db = getDb();
  db.delete(projects).where(eq(projects.id, id)).run();
}
