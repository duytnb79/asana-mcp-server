import type { AsanaConfig } from "../config.js";
import { AsanaApiError } from "./errors.js";
import type { AsanaNextPage, AsanaPage, JsonObject } from "./types.js";

const ASANA_BASE_URL = "https://app.asana.com/api/1.0/";

type RequestMethod = "GET" | "POST" | "PUT";

export type PageParams = {
  limit?: number;
  offset?: string;
  optFields?: string[];
};

export type TaskListParams = PageParams & {
  completedSince?: string;
};

export type ProjectListParams = PageParams & {
  workspaceGid: string;
  archived?: boolean;
};

export type SearchTaskParams = {
  assignee?: string[];
  completed?: boolean;
  modifiedSince?: string;
  project?: string[];
  text?: string;
  limit?: number;
  sortBy?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at";
  sortAscending?: boolean;
  optFields?: string[];
};

export class AsanaClient {
  constructor(private readonly config: AsanaConfig) {}

  async listTasks(projectGid: string, params: TaskListParams): Promise<AsanaPage<JsonObject>> {
    return this.getPage(`/projects/${encodeURIComponent(projectGid)}/tasks`, {
      completed_since: params.completedSince,
      limit: params.limit,
      offset: params.offset,
      opt_fields: params.optFields,
    });
  }

  async getTask(taskGid: string, optFields?: string[]): Promise<JsonObject> {
    return this.getObject(`/tasks/${encodeURIComponent(taskGid)}`, {
      opt_fields: optFields,
    });
  }

  async createTask(data: JsonObject, optFields?: string[]): Promise<JsonObject> {
    return this.getObject("/tasks", { opt_fields: optFields }, "POST", data);
  }

  async updateTask(taskGid: string, data: JsonObject, optFields?: string[]): Promise<JsonObject> {
    return this.getObject(`/tasks/${encodeURIComponent(taskGid)}`, { opt_fields: optFields }, "PUT", data);
  }

  async searchTasks(workspaceGid: string, params: SearchTaskParams): Promise<JsonObject[]> {
    return this.getList(`/workspaces/${encodeURIComponent(workspaceGid)}/tasks/search`, {
      "assignee.any": params.assignee,
      completed: params.completed,
      "modified_at.after": params.modifiedSince,
      "projects.any": params.project,
      text: params.text,
      limit: params.limit,
      sort_by: params.sortBy,
      sort_ascending: params.sortAscending,
      opt_fields: params.optFields,
    });
  }

  async listProjects(params: ProjectListParams): Promise<AsanaPage<JsonObject>> {
    return this.getPage("/projects", {
      workspace: params.workspaceGid,
      archived: params.archived,
      limit: params.limit,
      offset: params.offset,
      opt_fields: params.optFields,
    });
  }

  async listSections(projectGid: string, params: PageParams): Promise<AsanaPage<JsonObject>> {
    return this.getPage(`/projects/${encodeURIComponent(projectGid)}/sections`, {
      limit: params.limit,
      offset: params.offset,
      opt_fields: params.optFields,
    });
  }

  async addComment(taskGid: string, text: string, optFields?: string[]): Promise<JsonObject> {
    return this.getObject(`/tasks/${encodeURIComponent(taskGid)}/stories`, { opt_fields: optFields }, "POST", { text });
  }

  private async getPage(path: string, query?: Record<string, unknown>): Promise<AsanaPage<JsonObject>> {
    const envelope = await this.getEnvelope(path, query);
    if (!Array.isArray(envelope.data)) {
      throw new AsanaApiError("Asana API returned an unexpected response shape");
    }

    const data = envelope.data.map((item) => this.requireObject(item));
    return {
      data,
      nextPage: this.parseNextPage(envelope.next_page),
    };
  }

  private async getList(path: string, query?: Record<string, unknown>): Promise<JsonObject[]> {
    const envelope = await this.getEnvelope(path, query);
    if (!Array.isArray(envelope.data)) {
      throw new AsanaApiError("Asana API returned an unexpected response shape");
    }
    return envelope.data.map((item) => this.requireObject(item));
  }

  private async getObject(
    path: string,
    query?: Record<string, unknown>,
    method: RequestMethod = "GET",
    body?: JsonObject,
  ): Promise<JsonObject> {
    const envelope = await this.getEnvelope(path, query, method, body);
    return this.requireObject(envelope.data);
  }

  private async getEnvelope(
    path: string,
    query?: Record<string, unknown>,
    method: RequestMethod = "GET",
    body?: JsonObject,
  ): Promise<JsonObject> {
    const response = await this.request(path, query, method, body);
    return this.requireObject(response);
  }

  private async request(
    path: string,
    query?: Record<string, unknown>,
    method: RequestMethod = "GET",
    body?: JsonObject,
  ): Promise<unknown> {
    const url = new URL(path.replace(/^\/+/, ""), ASANA_BASE_URL);
    this.appendQuery(url, query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.config.accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify({ data: body }) : undefined,
        signal: controller.signal,
      });

      const payload = await this.safeJson(response);
      if (!response.ok) {
        throw this.mapHttpError(response.status, payload, response.headers.get("retry-after"), url);
      }

      if (payload === undefined) {
        throw new AsanaApiError(`Asana API returned an empty or non-JSON response (URL: ${url.toString()})`);
      }
      return payload;
    } catch (error) {
      if (error instanceof AsanaApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AsanaApiError(`Asana API request timed out after ${this.config.timeoutMs}ms`);
      }

      throw new AsanaApiError(error instanceof Error ? error.message : "Asana API request failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  private appendQuery(url: URL, query?: Record<string, unknown>): void {
    if (!query) {
      return;
    }

    for (const [key, value] of Object.entries(query)) {
      if (value == null) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          url.searchParams.set(key, value.map(String).join(","));
        }
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  private parseNextPage(value: unknown): AsanaNextPage | null {
    if (value == null) {
      return null;
    }

    const nextPage = this.requireObject(value);
    if (typeof nextPage.offset !== "string" || nextPage.offset.length === 0) {
      throw new AsanaApiError("Asana API returned an unexpected pagination shape");
    }

    return {
      offset: nextPage.offset,
      path: typeof nextPage.path === "string" ? nextPage.path : undefined,
      uri: typeof nextPage.uri === "string" ? nextPage.uri : undefined,
    };
  }

  private requireObject(value: unknown): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new AsanaApiError("Asana API returned an unexpected response shape");
    }
    return value as JsonObject;
  }

  private async safeJson(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return undefined;
    }

    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  private mapHttpError(status: number, details: unknown, retryAfter: string | null, url: URL): AsanaApiError {
    let message: string;
    switch (status) {
      case 400:
        message = "Asana rejected the request as invalid";
        break;
      case 401:
        message = "Asana authentication failed; check ASANA_ACCESS_TOKEN";
        break;
      case 403:
        message = "Asana permission failed for the requested resource or operation";
        break;
      case 404:
        message = "Requested Asana resource was not found";
        break;
      case 429:
        message = "Asana rate limit exceeded";
        break;
      default:
        message = status >= 500 ? "Asana API returned a server error" : `Asana API request failed with status ${status}`;
    }

    const retryAfterSeconds = retryAfter == null ? undefined : Number.parseInt(retryAfter, 10);
    if (status === 429 && Number.isInteger(retryAfterSeconds) && retryAfterSeconds! >= 0) {
      message += `; retry after ${retryAfterSeconds} seconds`;
    }

    message += ` (URL: ${url.toString()})`;
    return new AsanaApiError(message, status, details, retryAfterSeconds);
  }
}
