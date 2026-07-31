#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AsanaClient } from "./asana/client.js";
import { toReadableError } from "./asana/errors.js";
import { loadConfig } from "./config.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerSectionTools } from "./tools/sections.js";
import { registerStoryTools } from "./tools/stories.js";
import { registerTaskTools } from "./tools/tasks.js";

const config = loadConfig();
const client = new AsanaClient(config);

const server = new McpServer({
  name: "@duytnb79/asana-mcp",
  version: "0.1.0",
});

registerProjectTools(server, client, config.maxPageSize);
registerSectionTools(server, client, config.maxPageSize);
registerStoryTools(server, client);
registerTaskTools(server, client, config.maxPageSize);

process.on("uncaughtException", (error: Error) => {
  console.error(toReadableError(error));
  process.exit(1);
});

process.on("unhandledRejection", (error: unknown) => {
  console.error(toReadableError(error));
  process.exit(1);
});

const transport = new StdioServerTransport();
await server.connect(transport);
