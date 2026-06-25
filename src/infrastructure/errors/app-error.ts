export class AppError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown> | undefined;

  public constructor(code: string, options?: { message?: string; context?: Record<string, unknown>; cause?: unknown }) {
    super(options?.message ?? code, options?.cause ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.code = code;
    this.context = options?.context;
  }
}
