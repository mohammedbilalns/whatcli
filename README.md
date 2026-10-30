# WhatCLI

A pure Command Line Interface (CLI) and background daemon for interacting with WhatsApp.

**Note: WhatCLI is strictly a command-line tool. There are absolutely no plans to add any kind of GUI. It is designed to be composable, fast, terminal-native, and fully integrated with the Model Context Protocol (MCP) for AI agents.**

---

## Features

### Currently Implemented
- [x] **Authentication:** Login via QR code and securely manage sessions (`login`, `logout`)
- [x] **Session Management:** Check connection status, daemon liveness, and diagnostics (`status`, `doctor`)
- [x] **Unix Piping & Composability:** Stream inputs via `stdin`, pipe clean data to `grep`, `awk`, `cut`, `jq`, and `head` without crashes
- [x] **Machine-Readable Outputs:** Structured `--json` and `--plain` (TSV) flags across query and mutation commands
- [x] **Messaging:** Send text messages directly or piped from stdin (`send`)
- [x] **Media Support:** Send images and documents via file path or piped stdin (`send-image`, `send-document`, `media download`)
- [x] **Chat Management:** List recent chats and fetch conversation history (`chats`, `history`)
- [x] **Group Support:** List groups and inspect live participant roles/metadata (`groups`, `group info`)
- [x] **Contact Management:** Search, alias, and live-lookup WhatsApp numbers (`contacts`, `contact rename`, `contact lookup`)
- [x] **Interactivity:** Reply to and react to specific messages (`reply`, `react`)
- [x] **Search:** Full-text search through locally indexed message history (`search`)
- [x] **Dynamic Automations:** Trigger auto-replies or reactions based on regex or keywords without restarting the daemon (`rule add`, `rules`)
- [x] **Daemon Mode:** Background service that owns the connection, stores messages, and serves IPC (`daemon`, `stop`)
- [x] **Model Context Protocol (MCP):** Built-in MCP server for AI agents like Claude Desktop, Cursor, and Pi (`mcp`)

---

## Usage Highlights

### Starting the Daemon
WhatCLI runs a background daemon that maintains the WhatsApp WebSocket connection and exposes a fast local IPC socket:
```bash
wacli daemon

# Or run silently in the background:
wacli daemon --quiet
```

To stop the daemon cleanly (or forcefully if unresponsive):
```bash
wacli stop

# Force stop via process SIGTERM/SIGKILL:
wacli stop --force
```

### Checking Status
```bash
# Human-readable summary:
wacli status

# Machine-readable JSON:
wacli status --json | jq .

# Silent check for scripts (exit code 0 if connected, 1 if offline/disconnected):
if wacli status -q; then
  echo "WhatsApp is online"
fi
```

### Login Flow
Log in by scanning the QR code in your terminal:
```bash
wacli login
```

---

## Unix Piping & Shell Scripting

WhatCLI adheres to the Unix philosophy: **data goes to stdout, diagnostics go to stderr, and inputs can be streamed from stdin**.

### 1. Piped Inputs (stdin)
Send messages directly from terminal pipelines or files without passing CLI arguments:
```bash
# Pipe text from any command into a chat
echo "Deployment completed successfully!" | wacli send OpsTeam

# Send file contents
cat notes.txt | wacli send John -

# Reply to a message using stdin
echo "Confirmed" | wacli reply OpsTeam 3EB0C825 -

# Stream an image or document from stdin using '-'
cat chart.png | wacli send-image Team - "Q3 Metrics"
cat invoice.pdf | wacli send-document Accounting -
```

### 2. JSON & jq Integration
Every command supports `--json` for scripting:
```bash
# Extract recent chat names
wacli chats --json | jq -r '.[].name'

# Get message texts from history
wacli history Team -n 10 --json | jq -r '.[].text'

# Search messages matching a keyword
wacli search "invoice" --json | jq '.[0]'
```

### 3. Delimited Output for `awk` and `cut`
Tabular outputs automatically strip ANSI color codes when piped, or with `--plain`:
```bash
# Extract chat IDs and names using cut
wacli chats | cut -f 1,3

# Filter specific columns with awk
wacli chats | awk -F'\t' '{print $3}' | head -n 5
```

---

## Model Context Protocol (MCP) Integration

WhatCLI includes a native Model Context Protocol (MCP) server over `stdio`. This allows local AI agents (e.g. Claude Desktop, Cursor, Pi, Cline) to read, search, and send WhatsApp messages safely.

### Starting the MCP Server
```bash
wacli mcp

# Start in read-only mode (disables all sending/mutating tools):
wacli mcp --read-only
```

### Agent Configuration

Add WhatCLI to your agent's MCP configuration (e.g. `claude_desktop_config.json` or `mcp.json`):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "wacli",
      "args": ["mcp"]
    }
  }
}
```

Or for safe read-only access:
```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "wacli",
      "args": ["mcp", "--read-only"]
    }
  }
}
```

### Exposed MCP Tools

| Tool | Permission | Description |
|---|---|---|
| `list_chats` | Read-only | List recent conversations, types, and timestamps |
| `get_chat_history` | Read-only | Retrieve chronological message history for a chat |
| `search_messages` | Read-only | Full-text search across stored message history |
| `list_contacts` | Read-only | List contacts, aliases, and phone numbers |
| `get_connection_status` | Read-only | Check WhatsApp and daemon connectivity |
| `send_message` | Action | Send a text message to a contact or group |
| `send_reply` | Action | Reply to a specific message ID in context |
| `send_reaction` | Action | React with an emoji (or clear a reaction) |
| `lookup_phone` | Action | Live lookup of phone numbers on WhatsApp |

### Exposed MCP Resources
- `whatsapp://chats` — Complete list of known chats
- `whatsapp://contacts` — Contact roster and alias mappings

---

## Automations & Rules

Create auto-replies or reactions triggered by keywords or regex:
```bash
# Add a keyword rule (replies immediately when matched)
wacli rule add keyword "ping" --value "pong"

# Add a regex rule scoped to direct messages only
wacli rule add regex "^/help" --action reply --value "Available commands: status, info" --chat direct

# Manage rules (live updates take effect in the daemon immediately)
wacli rules
wacli rule off 1
wacli rule on 1
wacli rule remove 1
```

---

## Comparison with Similar Tools

| Feature / Tool | WhatCLI | wa-automate / whatsapp-web.js | Baileys (Library) |
| :--- | :--- | :--- | :--- |
| **Type** | Ready-to-use CLI, Daemon & MCP | Node.js Library (SDK) | Node.js Library (SDK) |
| **Technology** | Native WebSocket Protocol | Headless Browser (Puppeteer) | Native WebSocket Protocol |
| **Resource Usage** | Very Low | High (Runs Chromium) | Very Low |
| **Setup Required** | None (Zero coding required) | Requires writing custom scripts | Requires writing custom scripts |
| **Built-in Database** | Yes (SQLite WAL mode) | No | No |
| **AI Agent Support** | Native MCP Server | No | No |
| **Daemon & IPC** | Yes | No | No |
| **Unix Pipable** | Yes (`stdin`, `stdout`, `jq`) | No | No |

---

## Development

```bash
# Run CLI in dev mode
pnpm dev --help

# Run tests
pnpm test

# Lint & Format
pnpm lint
pnpm format

# Typecheck & Build
pnpm typecheck
pnpm build
```

## License
ISC
