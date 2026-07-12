/**
 * 结构化业务错误。
 * 每个错误包含类别（category）和可读消息，便于在 API / CLI 边界统一转换输出。
 */
export class DomainError extends Error {
  constructor(
    public readonly category: DomainErrorCategory,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DomainError";
  }
}

export type DomainErrorCategory =
  | "validation"
  | "not_found"
  | "conflict"
  | "duplicate"
  | "integrity"
  | "import_error"
  | "internal";
