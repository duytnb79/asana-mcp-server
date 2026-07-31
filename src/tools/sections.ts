import { z } from "zod";
import type { AsanaClient } from "../asana/client.js";
import { clampLimit } from "../config.js";

const listSectionsSchema = {
  project_gid: z.string().min(1).describe("Project GID."),
  limit: z.number().int().positive().max(100).optional().describe("Results per page, from 1 to 100."),
  offset: z.string().min(1).optional().describe("Offset returned by a previous list_sections call."),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional Asana section fields to return."),
};

export function registerSectionTools(
  server: { registerTool: Function },
  client: AsanaClient,
  maxPageSize: number,
): void {
  server.registerTool(
    "list_sections",
    {
      title: "List sections",
      description: "List sections in an Asana project with offset pagination.",
      inputSchema: z.object(listSectionsSchema),
    },
    async (input: z.infer<z.ZodObject<typeof listSectionsSchema>>) => {
      const page = await client.listSections(input.project_gid, {
        limit: clampLimit(input.limit, maxPageSize),
        offset: input.offset,
        optFields: input.opt_fields,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sections: page.data,
            meta: { count: page.data.length, next_offset: page.nextPage?.offset ?? null },
          }, null, 2),
        }],
      };
    },
  );
}
