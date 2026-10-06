# WhatCLI

A pure Command Line Interface (CLI) for interacting with the WhatsApp backend. 

**Note: WhatCLI is strictly a command-line tool. There are absolutely no plans to add any kind of UI. It is designed to be composable, fast, and terminal-native.**

## Features

### Currently Implemented
- [x] **Authentication:** Login via QR code and securely manage sessions (`login`, `logout`)
- [x] **Session Management:** Check connection status (`status`, `doctor`)
- [x] **Messaging:** Send text messages (`send`)
- [x] **Media Support:** Send images and documents (`send-image`, `send-document`, `media`)
- [x] **Chat Management:** List recent chats and fetch conversations (`chats`, `history`)
- [x] **Group Support:** List and inspect WhatsApp groups (`groups`, `group`)
- [x] **Contact Management:** Search, alias, and manage WhatsApp contacts (`contacts`, `contact`)
- [x] **Interactivity:** Reply to and react to specific messages (`reply`, `react`)
- [x] **Search:** Search through locally stored messages (`search`)
- [x] **Automations:** Trigger auto-replies or reactions based on regex or keywords (`wacli rule`)
- [x] **Daemon Mode:** Background service that owns the connection, stores messages, and serves IPC (`daemon`)

## Usage Highlights

### Starting the Daemon
WhatCLI now runs a background daemon that handles connections and IPC.
```bash
wacli daemon
# Or to run without printing live messages:
wacli daemon --quiet
```
This daemon architecture makes the DB fast and allows other commands (`send`, `chats`) to interact instantly over IPC.

### Login Flow
You can log in by scanning a QR code provided in the terminal:
```bash
wacli login
```

### Planned / Future Features
- [ ] **Plugin System:** Integrate with npm packages to allow custom extensions, scripts, and deeper integrations.
- [ ] **Group Administration:** Create groups, add/remove participants, modify group info.
- [ ] **Scheduled Messages:** Queue messages to be sent at a specific future time.
- [ ] **Bulk Actions:** Send broadcast messages to multiple contacts.
- [ ] **Exporting:** Export chat history to structured formats like JSON or CSV.

## Philosophy
`whatcli` is built for developers and power users who want to script or interact with WhatsApp without leaving the terminal. By adhering to a strict CLI-only approach (no UI), it can be easily integrated into shell scripts, cron jobs, and other automation pipelines.

## Comparison with Similar Tools

While tools like `wa-automate-nodejs` (open-wa) and `whatsapp-web.js` share the goal of automating WhatsApp, they differ fundamentally in architecture and target audience. WhatCLI is a **ready-to-use application**, whereas others are libraries.

| Feature / Tool | WhatCLI | wa-automate / whatsapp-web.js | Baileys (Library) |
| :--- | :--- | :--- | :--- |
| **Type** | Ready-to-use CLI & Daemon | Node.js Library (SDK) | Node.js Library (SDK) |
| **Technology** | Native WebSocket Protocol | Headless Browser (Puppeteer) | Native WebSocket Protocol |
| **Resource Usage** | Very Low | High (Runs full Chromium) | Very Low |
| **Setup Required** | None (Zero coding required) | Requires writing custom scripts | Requires writing custom scripts |
| **Built-in Database** | Yes (SQLite) | No | No |
| **Built-in Automations** | Yes (Rule Engine) | No | No |
| **Daemon / IPC** | Yes | No | No |
