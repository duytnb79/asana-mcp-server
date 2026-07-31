import { z } from "zod";
import type { AsanaClient } from "../asana/client.js";
import { clampLimit } from "../config.js";

const listProjectsSchema = {
  workspace_gid: z.string().min(1).describe("Workspace or organization GID."),
  archived: z.boolean().optional().describe("Return only archived or active projects."),
  limit: z.number().int().positive().max(100).optional().describe("Results per page, from 1 to 100."),
  offset: z.string().min(1).optional().describe("Offset returned by a previous list_projects call."),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional Asana project fields to return."),
};

export function registerProjectTools(
  server: { registerTool: Function },
  client: AsanaClient,
  maxPageSize: number,
): void {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List Asana projects in a workspace with offset pagination.",
      inputSchema: z.object(listProjectsSchema),
    },
    async (input: z.infer<z.ZodObject<typeof listProjectsSchema>>) => {
      const page = await client.listProjects({
        workspaceGid: input.workspace_gid,
        archived: input.archived,
        limit: clampLimit(input.limit, maxPageSize),
        offset: input.offset,
        optFields: input.opt_fields,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            projects: page.data,
            meta: { count: page.data.length, next_offset: page.nextPage?.offset ?? null },
          }, null, 2),
        }],
      };
    },
  );
}
