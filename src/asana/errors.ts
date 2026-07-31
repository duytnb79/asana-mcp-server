export class AsanaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AsanaApiError";
  }
}

export function toReadableError(error: unknown): string {
  if (error instanceof AsanaApiError) {
    let message = error.message;
    if (error.details) {
      try {
        message += ` (Details: ${JSON.stringify(error.details, null, 2)})`;
      } catch {
        // Fall back to the readable message when details cannot be stringified.
      }
    }
    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
