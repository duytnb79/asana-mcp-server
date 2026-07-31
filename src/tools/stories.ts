import { z } from "zod";
import type { AsanaClient } from "../asana/client.js";

const addCommentSchema = {
  task_gid: z.string().min(1).describe("Task GID."),
  text: z.string().min(1).describe("Plain-text comment to add to the task."),
  opt_fields: z.array(z.string().min(1)).optional().describe("Additional story fields to return."),
};

export function registerStoryTools(server: { registerTool: Function }, client: AsanaClient): void {
  server.registerTool(
    "add_comment",
    {
      title: "Add comment",
      description: "Add a plain-text comment to an Asana task. This operation writes to Asana.",
      inputSchema: z.object(addCommentSchema),
    },
    async (input: z.infer<z.ZodObject<typeof addCommentSchema>>) => {
      const story = await client.addComment(input.task_gid, input.text, input.opt_fields);
      return {
        content: [{ type: "text", text: JSON.stringify({ story }, null, 2) }],
      };
    },
  );
}
