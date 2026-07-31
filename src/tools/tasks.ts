import { z } from "zod";
import type { AsanaClient } from "../asana/client.js";
import type { JsonObject } from "../asana/types.js";
import { clampLimit } from "../config.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");
const dateTimeSchema = z.string().datetime({ offset: true });
const identifierListSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);
const resourceSubtypeSchema = z.enum(["default_task", "milestone", "approval", "custom"]);
const approvalStatusSchema = z.enum(["pending", "approved", "rejected", "changes_requested"]);

const listTasksInputSchema = z.object({
  project_gid: z.string().min(1).describe("Project GID."),
  completed_since: z.union([z.literal("now"), dateTimeSchema]).optional()
    .describe("Return incomplete tasks and tasks completed since this ISO timestamp; use 'now' for incomplete tasks only."),
  limit: z.number().int().positive().max(100).optional().describe("Results per page, from 1 to 100."),
  offset: z.string().min(1).optional().describe("Offset returned by a previous list_tasks call."),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional Asana task fields to return."),
});

const getTaskInputSchema = z.object({
  gid: z.string().min(1).describe("Task GID."),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional Asana task fields to return."),
});

const createTaskInputSchema = z.object({
  workspace: z.string().min(1).optional().describe("Workspace GID. Required unless projects or parent identifies the workspace."),
  projects: z.array(z.string().min(1)).min(1).optional().describe("Project GIDs to add the new task to."),
  parent: z.string().min(1).optional().describe("Parent task GID when creating a subtask."),
  name: z.string().min(1).describe("Task name."),
  notes: z.string().optional().describe("Plain-text task description."),
  assignee: z.string().min(1).nullable().optional().describe("User GID, email, 'me', or null to leave unassigned."),
  completed: z.boolean().optional(),
  approval_status: approvalStatusSchema.optional(),
  resource_subtype: resourceSubtypeSchema.optional(),
  due_on: dateSchema.optional(),
  due_at: dateTimeSchema.optional(),
  start_on: dateSchema.optional(),
  start_at: dateTimeSchema.optional(),
  followers: z.array(z.string().min(1)).min(1).optional(),
  tags: z.array(z.string().min(1)).min(1).optional(),
  custom_fields: z.record(z.unknown()).optional(),
  liked: z.boolean().optional(),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional fields to return for the created task."),
});

const updateTaskInputSchema = z.object({
  gid: z.string().min(1).describe("Task GID."),
  name: z.string().min(1).optional(),
  notes: z.string().optional().describe("Plain-text task description; use an empty string to clear it."),
  assignee: z.string().min(1).nullable().optional().describe("User GID, email, 'me', or null to unassign."),
  completed: z.boolean().optional(),
  approval_status: approvalStatusSchema.optional(),
  resource_subtype: resourceSubtypeSchema.optional(),
  due_on: dateSchema.nullable().optional(),
  due_at: dateTimeSchema.nullable().optional(),
  start_on: dateSchema.nullable().optional(),
  start_at: dateTimeSchema.nullable().optional(),
  custom_fields: z.record(z.unknown()).optional(),
  liked: z.boolean().optional(),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional fields to return for the updated task."),
});

const searchTasksInputSchema = z.object({
  workspace_gid: z.string().min(1).describe("Workspace or organization GID."),
  assignee: identifierListSchema.optional().describe("One assignee identifier or a list of assignee identifiers."),
  completed: z.boolean().optional(),
  modified_since: dateTimeSchema.optional().describe("Only tasks modified after this ISO timestamp."),
  project: identifierListSchema.optional().describe("One project GID or a list of project GIDs."),
  text: z.string().min(1).optional().describe("Search task names and descriptions."),
  limit: z.number().int().positive().max(100).optional().describe("Maximum search results, from 1 to 100."),
  sort_by: z.enum(["due_date", "created_at", "completed_at", "likes", "modified_at"]).optional(),
  sort_ascending: z.boolean().optional(),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional Asana task fields to return."),
});

type DateFields = {
  due_on?: string | null;
  due_at?: string | null;
  start_on?: string | null;
  start_at?: string | null;
};

function validateDateFields(fields: DateFields): void {
  if (fields.due_on !== undefined && fields.due_at !== undefined) {
    throw new Error("due_on and due_at cannot be provided together");
  }
  if (fields.start_on !== undefined && fields.start_at !== undefined) {
    throw new Error("start_on and start_at cannot be provided together");
  }
  if (fields.start_on !== undefined && fields.due_on === undefined && fields.due_at === undefined) {
    throw new Error("start_on requires due_on or due_at in the same request");
  }
  if (fields.start_at !== undefined && fields.due_at === undefined) {
    throw new Error("start_at requires due_at in the same request");
  }
}

function setDefined(target: JsonObject, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function toIdentifierArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value : [value];
}

export function registerTaskTools(
  server: { registerTool: Function },
  client: AsanaClient,
  maxPageSize: number,
): void {
  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "List tasks in an Asana project in project priority order.",
      inputSchema: listTasksInputSchema,
    },
    async (input: z.infer<typeof listTasksInputSchema>) => {
      const page = await client.listTasks(input.project_gid, {
        completedSince: input.completed_since,
        limit: clampLimit(input.limit, maxPageSize),
        offset: input.offset,
        optFields: input.opt_fields,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tasks: page.data,
            meta: { count: page.data.length, next_offset: page.nextPage?.offset ?? null },
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "Get details for one Asana task.",
      inputSchema: getTaskInputSchema,
    },
    async (input: z.infer<typeof getTaskInputSchema>) => {
      const task = await client.getTask(input.gid, input.opt_fields);
      return {
        content: [{ type: "text", text: JSON.stringify({ task }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description: "Create an Asana task. This operation writes to Asana.",
      inputSchema: createTaskInputSchema,
    },
    async (input: z.infer<typeof createTaskInputSchema>) => {
      if (!input.workspace && !input.projects && !input.parent) {
        throw new Error("create_task requires at least one of workspace, projects, or parent");
      }
      validateDateFields(input);
      if (input.resource_subtype === "milestone" && (input.start_on !== undefined || input.start_at !== undefined)) {
        throw new Error("Milestones cannot have a start date or start time");
      }

      const data: JsonObject = { name: input.name };
      setDefined(data, "workspace", input.workspace);
      setDefined(data, "projects", input.projects);
      setDefined(data, "parent", input.parent);
      setDefined(data, "notes", input.notes);
      setDefined(data, "assignee", input.assignee);
      setDefined(data, "completed", input.completed);
      setDefined(data, "approval_status", input.approval_status);
      setDefined(data, "resource_subtype", input.resource_subtype);
      setDefined(data, "due_on", input.due_on);
      setDefined(data, "due_at", input.due_at);
      setDefined(data, "start_on", input.start_on);
      setDefined(data, "start_at", input.start_at);
      setDefined(data, "followers", input.followers);
      setDefined(data, "tags", input.tags);
      setDefined(data, "custom_fields", input.custom_fields);
      setDefined(data, "liked", input.liked);

      const task = await client.createTask(data, input.opt_fields);
      return {
        content: [{ type: "text", text: JSON.stringify({ task }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: "Update fields on an Asana task. This operation writes to Asana.",
      inputSchema: updateTaskInputSchema,
    },
    async (input: z.infer<typeof updateTaskInputSchema>) => {
      validateDateFields(input);
      if (input.resource_subtype === "milestone" && (input.start_on !== undefined || input.start_at !== undefined)) {
        throw new Error("Milestones cannot have a start date or start time");
      }

      const data: JsonObject = {};
      setDefined(data, "name", input.name);
      setDefined(data, "notes", input.notes);
      setDefined(data, "assignee", input.assignee);
      setDefined(data, "completed", input.completed);
      setDefined(data, "approval_status", input.approval_status);
      setDefined(data, "resource_subtype", input.resource_subtype);
      setDefined(data, "due_on", input.due_on);
      setDefined(data, "due_at", input.due_at);
      setDefined(data, "start_on", input.start_on);
      setDefined(data, "start_at", input.start_at);
      setDefined(data, "custom_fields", input.custom_fields);
      setDefined(data, "liked", input.liked);

      if (Object.keys(data).length === 0) {
        throw new Error("update_task requires at least one field to update");
      }

      const task = await client.updateTask(input.gid, data, input.opt_fields);
      return {
        content: [{ type: "text", text: JSON.stringify({ task }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "search_tasks",
    {
      title: "Search tasks",
      description: "Search tasks in an Asana workspace. Search indexing is eventually consistent and may lag writes by 10-60 seconds.",
      inputSchema: searchTasksInputSchema,
    },
    async (input: z.infer<typeof searchTasksInputSchema>) => {
      const tasks = await client.searchTasks(input.workspace_gid, {
        assignee: toIdentifierArray(input.assignee),
        completed: input.completed,
        modifiedSince: input.modified_since,
        project: toIdentifierArray(input.project),
        text: input.text,
        limit: clampLimit(input.limit, maxPageSize),
        sortBy: input.sort_by,
        sortAscending: input.sort_ascending,
        optFields: input.opt_fields,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tasks,
            meta: {
              count: tasks.length,
              pagination: "Search does not support Asana offset pagination.",
              consistency: "Results are eventually consistent and may lag recent writes.",
            },
          }, null, 2),
        }],
      };
    },
  );
}
