import { describe, expect, it } from "bun:test";
import { DomainError } from "@northstar/shared";

describe("DomainError", () => {
  it("creates error with category and message", () => {
    const err = new DomainError("not_found", "Resource not found");
    expect(err.category).toBe("not_found");
    expect(err.message).toBe("Resource not found");
    expect(err.name).toBe("DomainError");
  });

  it("supports cause chain", () => {
    const inner = new Error("inner");
    const err = new DomainError("internal", "outer", { cause: inner });
    expect(err.cause).toBe(inner);
  });
});
