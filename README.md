# @duytnb79/asana-mcp

A local MCP server for Asana that uses an Asana personal access token (PAT).

It runs over stdio and calls the standard Asana REST API at `https://app.asana.com/api/1.0`. It is separate from Asana's hosted MCP server at `https://mcp.asana.com/v2/mcp`, which requires a registered MCP app and OAuth.

## Requirements

- Node.js 20+
- An Asana personal access token
- Access to the Asana workspaces, projects, and tasks you want to use

Create a PAT in the Asana developer console and treat it like a password. The server can only access data and perform actions allowed for the Asana user who owns the token.

## Installation

### Local clone

```bash
npm install
npm run build
cp .env.example .env
node dist/index.js
```

### Published package

After this package is published, it can be run with:

```bash
npx -y @duytnb79/asana-mcp
```

Or installed globally:

```bash
npm install -g @duytnb79/asana-mcp
asana-mcp
```

## Configuration

Create a `.env` file or provide environment variables through your MCP client:

```bash
ASANA_ACCESS_TOKEN="your_asana_personal_access_token"
ASANA_TIMEOUT_MS="10000"
ASANA_MAX_PAGE_SIZE="100"
```

Required:

- `ASANA_ACCESS_TOKEN`

Optional:

- `ASANA_TIMEOUT_MS` — request timeout in milliseconds; defaults to `10000`
- `ASANA_MAX_PAGE_SIZE` — maximum page size exposed by list/search tools; defaults to `100` and must be between `1` and `100`

The server automatically loads `.env` when running locally.

## MCP client configuration

### Local build

```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": [
        "/Users/genkisystem/Desktop/asana-mcp-server/dist/index.js"
      ],
      "env": {
        "ASANA_ACCESS_TOKEN": "your_asana_personal_access_token"
      }
    }
  }
}
```

Alternatively, run through npm from the project directory:

```json
{
  "mcpServers": {
    "asana": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/Users/genkisystem/Desktop/asana-mcp-server",
      "env": {
        "ASANA_ACCESS_TOKEN": "your_asana_personal_access_token"
      }
    }
  }
}
```

### Published package

```json
{
  "mcpServers": {
    "asana": {
      "command": "npx",
      "args": ["-y", "@duytnb79/asana-mcp"],
      "env": {
        "ASANA_ACCESS_TOKEN": "your_asana_personal_access_token"
      }
    }
  }
}
```

## Available tools

### Read tools

- `list_projects`
  - Lists projects in a workspace.
  - Supports `archived`, `limit`, `offset`, and `opt_fields`.
- `list_tasks`
  - Lists tasks in a project in project priority order.
  - Supports `completed_since`, `limit`, `offset`, and `opt_fields`.
- `get_task`
  - Gets one task by GID.
- `search_tasks`
  - Searches a workspace by assignee, completion state, modified time, project, or text.
  - Asana search is eventually consistent and may lag recent writes by 10–60 seconds.
  - The search endpoint does not support normal Asana offset pagination and returns at most 100 items.
- `list_sections`
  - Lists sections in a project.
  - Supports `limit`, `offset`, and `opt_fields`.

### Write tools

- `create_task`
  - Creates a task or subtask.
  - Requires at least one of `workspace`, `projects`, or `parent`.
- `update_task`
  - Updates fields on an existing task.
- `add_comment`
  - Adds a plain-text comment to a task.

Write tools make immediate changes in Asana. Configure your MCP client to require approval for these tools if you want a human confirmation step.

## Pagination

Asana list endpoints return an opaque `next_page.offset`. The MCP response exposes it as `meta.next_offset`.

Pass that value back as `offset` to retrieve the next page. Only use offsets returned by Asana; they can expire when underlying data changes.

## Input/output fields

Asana returns compact objects by default. Use `opt_fields` to request additional properties, for example:

```json
{
  "project_gid": "12345",
  "limit": 50,
  "opt_fields": [
    "name",
    "completed",
    "assignee.name",
    "due_on",
    "permalink_url"
  ]
}
```

Keep `opt_fields` focused. Very broad or deeply nested responses are more expensive and may be rate-limited.

## Rate limits and errors

- Asana returns HTTP `429` when a token is rate-limited.
- The server reports the `Retry-After` value when Asana provides it, but does not automatically retry write requests because retries could duplicate creations or comments.
- Authentication, permission, validation, not-found, timeout, and server errors are converted into readable MCP errors.
- The PAT is sent only in the `Authorization: Bearer` header and is never placed in request URLs.

## Security

- Never commit `.env` or a PAT.
- Prefer a dedicated PAT with the minimum user permissions needed for this integration.
- Rotate the PAT if it is exposed.
- Tool calls run with the permissions of the token owner.
- This server intentionally exposes specific Asana operations rather than a generic HTTP passthrough tool.

## Development

```bash
npm run dev
npm run typecheck
npm run build
npm start
```
