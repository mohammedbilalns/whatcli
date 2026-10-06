# WhatCLI

A pure Command Line Interface (CLI) for interacting with the WhatsApp backend. 

**Note: WhatCLI is strictly a command-line tool. There are absolutely no plans to add any kind of UI. It is designed to be composable, fast, and terminal-native.**

## Features

### Currently Implemented
- [x] **Authentication:** Login via QR code and securely manage sessions (`login`, `logout`)
- [x] **Session Management:** Check connection status (`status`)
- [x] **Messaging:** Send text messages (`send`)
- [x] **Media Support:** Send images and documents (`send-image`, `send-document`, `media`)
- [x] **Chat Management:** List recent chats and fetch conversations (`chats`, `history`)
- [x] **Interactivity:** Reply to and react to specific messages (`reply`, `react`)
- [x] **Search:** Search through messages (`search`)
- [x] **Live Listening:** Watch incoming messages in real-time (`watch`)

### Planned / Future Features
- [ ] **Group Support:** Create, manage, and interact with WhatsApp groups (add/remove participants, modify group info).
- [ ] **Automations:** Auto-responders, scriptable triggers, and basic bot capabilities directly from the CLI.
- [ ] **Scheduled Messages:** Queue messages to be sent at a specific future time.
- [ ] **Contact Management:** Sync, list, and manage WhatsApp contacts.
- [ ] **Bulk Actions:** Send broadcast messages to multiple contacts.
- [ ] **Exporting:** Export chat history to structured formats like JSON or CSV.

## Philosophy
`whatcli` is built for developers and power users who want to script or interact with WhatsApp without leaving the terminal. By adhering to a strict CLI-only approach (no UI), it can be easily integrated into shell scripts, cron jobs, and other automation pipelines.
