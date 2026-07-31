const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_PAGE_SIZE = 100;
const ASANA_PAGE_SIZE_LIMIT = 100;

export type AsanaConfig = {
  accessToken: string;
  timeoutMs: number;
  maxPageSize: number;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return value;
}

export function loadConfig(): AsanaConfig {
  const maxPageSize = parsePositiveInt("ASANA_MAX_PAGE_SIZE", DEFAULT_MAX_PAGE_SIZE);
  if (maxPageSize > ASANA_PAGE_SIZE_LIMIT) {
    throw new Error(`ASANA_MAX_PAGE_SIZE must be between 1 and ${ASANA_PAGE_SIZE_LIMIT}`);
  }

  return {
    accessToken: readRequiredEnv("ASANA_ACCESS_TOKEN"),
    timeoutMs: parsePositiveInt("ASANA_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    maxPageSize,
  };
}

export function clampLimit(limit: number | undefined, maxPageSize: number, fallback = 50): number {
  if (limit == null) {
    return Math.min(fallback, maxPageSize);
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer");
  }

  return Math.min(limit, maxPageSize, ASANA_PAGE_SIZE_LIMIT);
}
