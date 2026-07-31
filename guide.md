Được. Mình sẽ làm theo hướng PAT-based MCP Server, không phụ thuộc OAuth của Asana.

Cấu trúc project

asana-mcp/
├── package.json
├── tsconfig.json
├── .env
├── src/
│   ├── index.ts
│   ├── asana.ts
│   ├── tools/
│   │   ├── listTasks.ts
│   │   ├── getTask.ts
│   │   ├── createTask.ts
│   │   ├── updateTask.ts
│   │   ├── searchTasks.ts
│   │   ├── listProjects.ts
│   │   ├── listSections.ts
│   │   └── createStory.ts
│   └── types.ts

package.json

{
  "name": "asana-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1",
    "axios": "^1",
    "dotenv": "^16",
    "zod": "^3"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5"
  }
}

⸻

.env

ASANA_ACCESS_TOKEN=xxxxxxxxxxxxxxxx

⸻

Asana client

const client = axios.create({
    baseURL: "https://app.asana.com/api/1.0",
    headers: {
        Authorization: `Bearer ${process.env.ASANA_ACCESS_TOKEN}`
    }
});

⸻

MCP Tools

list_tasks

Input

{
  "project_gid": "...",
  "limit": 50
}

Output

[
  {
    "gid":"...",
    "name":"Fix Login",
    "completed":false
  }
]

⸻

get_task

Input

{
  "gid":"12345"
}

⸻

create_task

Input

{
  "workspace":"...",
  "name":"New task",
  "notes":"..."
}

⸻

update_task

{
  "gid":"123",
  "completed":true
}

⸻

search_tasks

Sử dụng

GET /workspaces/{gid}/tasks/search

filter:

* assignee
* completed
* modified_since
* project
* text

⸻

list_projects

GET /projects

⸻

list_sections

GET /projects/{gid}/sections

⸻

add_comment

POST /tasks/{gid}/stories

⸻

mcp.json

Claude Code / Cursor

{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": [
        "/Users/duy/asana-mcp/dist/index.js"
      ],
      "env": {
        "ASANA_ACCESS_TOKEN": "xxxxxxxx"
      }
    }
  }
}

hoặc

{
  "mcpServers": {
    "asana": {
      "command": "npm",
      "args": [
        "start"
      ],
      "cwd": "/Users/duy/asana-mcp",
      "env": {
        "ASANA_ACCESS_TOKEN": "xxxxxxxx"
      }
    }
  }
}

⸻

Tool mà AI sẽ thấy

asana_list_projects
asana_list_tasks
asana_get_task
asana_create_task
asana_update_task
asana_search_tasks
asana_list_sections
asana_add_comment

Sau này có thể mở rộng thêm:

* ✅ create project
* ✅ create section
* ✅ assign task
* ✅ add follower
* ✅ upload attachment
* ✅ create subtask
* ✅ create dependency
* ✅ complete task
* ✅ archive project
* ✅ custom fields
* ✅ milestones
* ✅ portfolio
* ✅ team
* ✅ webhook
* ✅ batch API

Mình đề xuất

Thay vì chỉ làm khoảng 10 tool, mình có thể xây dựng thành một Asana MCP đầy đủ, bao phủ gần như toàn bộ Asana REST API (khoảng 50–80 tool). Khi đó Claude/Cursor có thể thao tác với Asana tương tự MCP chính thức, nhưng dùng trực tiếp ASANA_ACCESS_TOKEN mà không cần OAuth. Đây sẽ hữu ích hơn nếu bạn dùng lâu dài.