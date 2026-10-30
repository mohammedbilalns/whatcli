# WhatCLI Architecture Documentation

This document provides a technical overview of WhatCLI's internal architecture, data flow, IPC design, database schemas, and integration points.

---

## 1. High-Level System Architecture

WhatCLI is split into three primary tiers:
1. **Clients & Interfaces:** The standard CLI (`wacli`), shell pipelines, and the Model Context Protocol (MCP) server for AI agents.
2. **IPC & Storage Core:** A local Unix domain socket (`wacli.sock`) and an embedded SQLite database (`wacli.db`) running in Write-Ahead Logging (WAL) mode.
3. **Daemon & Network Engine:** A long-lived background service that supervises the Baileys WebSocket connection, processes real-time events, manages Signal encryption keys, and executes automation rules.

```mermaid
flowchart TD
    subgraph Interfaces["1. Interfaces & Clients"]
        CLI["CLI Commands<br/>(wacli send, chats, status, etc.)"]
        Shell["Unix Shell Pipelines<br/>(stdin, stdout, grep, awk, jq)"]
        MCPAgent["AI Agents<br/>(Claude Desktop, Cursor, Pi)"]
        MCPServer["WhatCLI MCP Server<br/>(wacli mcp via stdio)"]
    end

    subgraph IPC_Storage["2. Inter-Process Communication & Storage"]
        IPCSock[("Unix Domain Socket<br/>data/wacli.sock")]
        SQLite[("SQLite Database (WAL Mode)<br/>data/wacli.db")]
    end

    subgraph Daemon["3. WhatCLI Daemon Service (wacli daemon)"]
        IPCServer["IPC Server<br/>(JSON-RPC Framing)"]
        Manager["WhatsAppManager<br/>(Connection Loop & Backoff)"]
        Automation["Rule Automation Engine<br/>(Dynamic RuleEngine)"]
        Store["MessageStore & ContactStore<br/>(Prepared Statements)"]
        Baileys["Baileys Socket<br/>(Noise Protocol & Signal Keys)"]
    end

    subgraph WhatsApp["4. WhatsApp Infrastructure"]
        WAWeb["WhatsApp Web Servers<br/>(Binary WebSocket Protocol)"]
    end

    %% Client flows
    CLI -->|"Read Queries (<5ms)"| SQLite
    CLI -->|"Action Requests"| IPCSock
    Shell <-->|"stdin / stdout"| CLI
    MCPAgent <-->|"JSON-RPC (stdio)"| MCPServer
    MCPServer -->|"Read Queries"| SQLite
    MCPServer -->|"Action Requests"| IPCSock

    %% Daemon flows
    IPCSock <--> IPCServer
    IPCServer -->|"Execute Action"| Baileys
    Manager -->|"Supervises"| Baileys
    Baileys -->|"Incoming Events"| Store
    Store -->|"Write (WAL)"| SQLite
    Store -->|"Trigger"| Automation
    Automation -->|"Auto-reply / React"| Baileys
    Baileys <-->|"TLS / WebSocket"| WAWeb
```

---

## 2. Core Workflows & Sequence Diagrams

### A. Message Dispatch Flow (CLI or MCP via IPC)

When a command like `wacli send` or an MCP agent sends a message:
1. The client resolves the recipient against the local SQLite database.
2. If the daemon is running, the client sends an IPC request over `wacli.sock`.
3. The daemon uses its live WebSocket to transmit and encrypt the message.
4. The message is indexed locally and the message ID is returned to stdout.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / AI Agent
    participant CLI as CLI / MCP Client
    participant DB as SQLite DB
    participant IPC as IPC Server (Daemon)
    participant Baileys as Baileys Socket
    participant WA as WhatsApp Server

    User->>CLI: wacli send "John" "Deploy complete"
    CLI->>DB: resolveChat("John")
    DB-->>CLI: { ok: true, jid: "919000000001@s.whatsapp.net" }
    
    CLI->>IPC: {"method": "send.text", "params": {"jid": "...", "text": "..."}}
    IPC->>Baileys: sock.sendMessage(jid, { text })
    Baileys->>WA: Binary Noise Frame (Encrypted Proto)
    WA-->>Baileys: Server Ack (Message ID)
    Baileys-->>IPC: Sent Message Model
    IPC->>DB: saveMessage(sentMessage)
    IPC-->>CLI: {"ok": true, "result": {"id": "3EB0..."}}
    CLI-->>User: id: 3EB0... (stdout)
```

---

### B. Real-Time Incoming Message & Dynamic Automation Flow

When a new message arrives from WhatsApp:
1. Baileys decrypts the message frame and parses it.
2. The message is persisted in SQLite inside an atomic transaction.
3. The `RuleEngine` dynamically queries active rules from the database (no restarts needed).
4. If a keyword or regex rule matches, an auto-reply or reaction is dispatched automatically.

```mermaid
sequenceDiagram
    autonumber
    participant WA as WhatsApp Server
    participant Baileys as Baileys Socket
    participant Daemon as Daemon Event Loop
    participant DB as SQLite DB
    participant Rules as RuleEngine
    actor Recipient as Remote Contact

    WA->>Baileys: Binary Message Frame
    Baileys->>Daemon: messages.upsert (live = true)
    Daemon->>DB: txSave(message) [Atomic WAL Insert]
    Daemon->>Rules: match(message)
    Rules->>DB: SELECT * FROM rules WHERE enabled = 1
    DB-->>Rules: Active Rules List
    
    alt Rule Matched (Keyword/Regex)
        Rules-->>Daemon: RuleHit { action: "reply", value: "Pong" }
        Daemon->>Baileys: sock.sendMessage(chatId, { text: "Pong" }, { quoted })
        Baileys->>WA: Transmit Auto-Reply
        WA-->>Recipient: Deliver "Pong"
        Daemon->>DB: recordHit(rule.id)
    else No Rule Matched
        Rules-->>Daemon: null (Ignore)
    end
```

---

### C. Model Context Protocol (MCP) Architecture

WhatCLI exposes an MCP server (`src/mcp/`) that AI agents connect to over standard input/output (`stdio`):

```mermaid
flowchart LR
    subgraph Host["AI Agent Host (Claude / Cursor / Pi)"]
        LLM["Large Language Model"]
        Client["MCP Client Transport"]
    end

    subgraph MCPServer["WhatCLI MCP Architecture"]
        Stdio["StdioServerTransport<br/>(stdin / stdout)"]
        Router["McpServer Router"]
        ReadTools["Read Tools<br/>(list_chats, get_chat_history,<br/>search_messages, list_contacts,<br/>get_connection_status)"]
        ActionTools["Action Tools<br/>(send_message, send_reply,<br/>send_reaction, lookup_phone)"]
        Resources["Resources<br/>(whatsapp://chats,<br/>whatsapp://contacts)"]
    end

    subgraph Backend["WhatCLI Core"]
        DB[("SQLite Database<br/>(Read-only, <5ms)")]
        Daemon["wacli daemon<br/>(wacli.sock IPC)"]
    end

    LLM <--> Client
    Client <-->|"JSON-RPC 2.0"| Stdio
    Stdio <--> Router
    Router --> ReadTools
    Router --> ActionTools
    Router --> Resources

    ReadTools -->|"Direct Queries"| DB
    Resources -->|"Direct Queries"| DB
    ActionTools -->|"IPC Requests"| Daemon
```

---

## 3. Database Schema & Indexing

The embedded SQLite database utilizes WAL mode (`PRAGMA journal_mode = WAL`) and is optimized with page caching (`PRAGMA cache_size = -64000`) and lock timeouts (`PRAGMA busy_timeout = 5000`).

```mermaid
erDiagram
    CHATS {
        text jid PK "WhatsApp JID (user or group)"
        text name "Display or group name"
        text type "direct or group"
        text last_message_at "Timestamp of last message"
        text created_at "Created timestamp"
        text alt_jid "Linked phone or LID JID"
    }

    MESSAGES {
        text id PK "WhatsApp message ID"
        text chat_id FK "Chat remote JID"
        text sender_id "Sender JID"
        integer from_me "1 if sent by user, 0 if received"
        text type "text, image, video, reaction, etc."
        text text "Message text or media caption"
        text reply_to_id "ID of quoted message"
        text timestamp "ISO timestamp"
        text push_name "Sender push name"
        text media_json "Raw media metadata"
    }

    CONTACTS {
        text jid PK "Contact JID"
        text name "Contact name"
        text alias "User custom alias"
        text phone "Normalized phone number"
        text push_name "WhatsApp push name"
        text updated_at "Last updated timestamp"
    }

    CONTACT_LINKS {
        text lid PK "LID JID"
        text phone PK "Phone JID"
    }

    RULES {
        integer id PK "Auto-increment ID"
        text trigger "type:pattern (e.g. keyword:ping)"
        text action "reply or react"
        text value "Reply text or reaction emoji"
        text chat "Scope: *, all, direct, group, or JID"
        integer enabled "1 = active, 0 = disabled"
        integer hit_count "Number of times fired"
        text last_fired "Timestamp when last fired"
        text created_at "Created timestamp"
    }

    SCHEMA_MIGRATIONS {
        text name PK "Migration identifier"
        text applied_at "Timestamp applied"
    }

    CHATS ||--o{ MESSAGES : "contains"
    CONTACTS ||--o{ CONTACT_LINKS : "maps to"
```

### Key Performance Indexes:
- `idx_chats_last_message` on `chats(last_message_at DESC)`: Powers sub-millisecond `wacli chats` queries.
- `idx_messages_chat_time` on `messages(chat_id, timestamp)`: Accelerates conversation history retrieval.
- `idx_messages_timestamp` on `messages(timestamp DESC)`: Optimizes global search and chronological scans.
- `idx_contacts_name` on `contacts(name)`: Accelerates contact name lookups and alias resolutions.

---

## 4. Connection Lifecycle & Reconnect Policy

The daemon manages the WebSocket connection using an event-driven supervisor loop:

```mermaid
stateDiagram-v2
    [*] --> Connecting: wacli daemon starts
    Connecting --> Connected: Handshake Successful
    Connecting --> Waiting: Timeout or Socket Error
    
    Connected --> Reconnecting: Network Drop / Disconnect
    Connected --> LoggedOut: Code 401 / 403 (Invalidated on Phone)
    Connected --> Stopped: wacli stop (SIGINT / SIGTERM)
    
    Reconnecting --> Connected: Reconnection Successful
    Reconnecting --> Waiting: Attempt Failed
    
    Waiting --> Reconnecting: Exponential Backoff Elapses (1s .. 60s)
    
    LoggedOut --> [*]: Clear Credentials & Exit
    Stopped --> [*]: Clean IPC & Socket Shutdown
```

### Policy Profiles:
- **`DAEMON_POLICY` (Daemon Mode):** Unbounded retries with exponential backoff (`delay = min(60s, 1s * 2^attempt)`). Designed to survive indefinite Wi-Fi and ISP outages without dying.
- **`DEFAULT_POLICY` (Ephemeral CLI Mode):** Caps at 8 attempts before giving up to prevent blocking the terminal indefinitely.

---

## 5. IPC Protocol Specification

Communication between CLI commands and the background daemon takes place over a local Unix domain socket (`data/wacli.sock`).

### Transport Framing
- Every message is a single line terminated by a newline (`\n`).
- The server processes messages in a streaming buffer loop to support pipelined or chunked requests without data loss.

### Request Format
```json
{
  "id": 1,
  "method": "send.text",
  "params": {
    "jid": "919000000001@s.whatsapp.net",
    "text": "Hello from CLI"
  }
}
```

### Response Format
```json
{
  "id": 1,
  "ok": true,
  "result": {
    "id": "3EB0ABC123",
    "status": "sent"
  }
}
```

### Supported IPC Methods
| Method | Parameters | Return Value | Description |
|---|---|---|---|
| `ping` | `{}` | `{ state, connectionState, connectionDetail, ingested, uptime }` | Health check & live status |
| `send.text` | `{ jid, text }` | `Message` | Transmit text message |
| `send.reply` | `{ jid, target, text }` | `Message` | Reply to message |
| `send.reaction`| `{ jid, target, emoji }` | `Message` | React with emoji |
| `send.image` | `{ jid, filePath, caption }` | `Message` | Send image file |
| `send.document`| `{ jid, filePath }` | `Message` | Send document file |
| `lookup` | `{ phone }` | `Array<{ jid, exists, lid }>` | Query number registration |
| `group.info` | `{ jid }` | `GroupInfo` | Live fetch group participants |
| `media.download` | `{ raw }` | `{ b64, mediaJson }` | Download media buffer |
| `stop` | `{}` | `{ stopping: true }` | Initiate graceful shutdown |
