import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { openDatabase } from "../../db/database.js";
import { IpcClient } from "../../ipc/client.js";
import { ContactStore } from "../../services/contact-store.js";
import { MessageStore } from "../../services/message-store.js";
import type { Config } from "../../utils/config.js";
import { useSqliteAuthState } from "../../whatsapp/auth.js";
import { jidLabel, phoneFromJid, resolveChat } from "../../whatsapp/jid.js";

export function registerReadTools(server: McpServer, config: Config): void {
	// 1. list_chats
	server.registerTool(
		"list_chats",
		{
			description:
				"List locally stored WhatsApp chats (direct messages and groups) with their IDs, names, types, and last message timestamps.",
			inputSchema: {
				limit: z
					.number()
					.optional()
					.default(50)
					.describe("Maximum number of chats to return (default: 50)"),
				type: z
					.enum(["all", "direct", "group"])
					.optional()
					.default("all")
					.describe("Filter chats by type: 'all', 'direct', or 'group'"),
			},
		},
		async ({ limit, type }) => {
			const db = openDatabase(config);
			try {
				const store = new MessageStore(db);
				let rows = store.listChats();
				if (type !== "all") {
					rows = rows.filter((r) => r.type === type);
				}
				const result = rows.slice(0, limit).map((r) => ({
					id: r.id,
					jid: r.jid,
					name: r.name ?? jidLabel(r.jid),
					type: r.type,
					lastMessageAt: r.last_message_at
						? new Date(r.last_message_at).toISOString()
						: null,
				}));
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} finally {
				db.close();
			}
		},
	);

	// 2. get_chat_history
	server.registerTool(
		"get_chat_history",
		{
			description:
				"Get chronological message history for a WhatsApp chat or contact.",
			inputSchema: {
				chat: z
					.string()
					.describe(
						"Chat name, contact alias, phone number, or JID (e.g. 'John', '+919876543210', or '120363@g.us')",
					),
				limit: z
					.number()
					.optional()
					.default(30)
					.describe("Number of recent messages to retrieve (default: 30)"),
			},
		},
		async ({ chat, limit }) => {
			const db = openDatabase(config);
			try {
				const resolved = resolveChat(db, chat);
				if (!resolved.ok) {
					if (resolved.error === "not-found") {
						return {
							isError: true,
							content: [
								{
									type: "text",
									text: `No chat matching "${chat}" found. Use list_chats to see available chats.`,
								},
							],
						};
					}
					const matches = resolved.candidates
						.map((c) => `${c.label} (${c.jid})`)
						.join(", ");
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `"${chat}" matches multiple chats: ${matches}. Please be more specific.`,
							},
						],
					};
				}

				const store = new MessageStore(db);
				const contacts = new ContactStore(db);
				const messages = store.listMessages(resolved.jid, limit);

				const result = messages.map((m) => ({
					id: m.id,
					chatId: m.chatId,
					senderId: m.senderId,
					senderName: contacts.displayName(m.senderId) ?? m.pushName ?? null,
					fromMe: m.fromMe,
					type: m.type,
					text: m.text ?? null,
					replyToId: m.replyToId ?? null,
					timestamp: m.timestamp.toISOString(),
				}));

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									chat: resolved.label,
									jid: resolved.jid,
									messageCount: result.length,
									messages: result,
								},
								null,
								2,
							),
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);

	// 3. search_messages
	server.registerTool(
		"search_messages",
		{
			description:
				"Search locally stored WhatsApp messages by text query across all chats.",
			inputSchema: {
				query: z.string().describe("Keyword or phrase to search for"),
				limit: z
					.number()
					.optional()
					.default(20)
					.describe("Maximum number of results to return (default: 20)"),
			},
		},
		async ({ query, limit }) => {
			const db = openDatabase(config);
			try {
				const contacts = new ContactStore(db);
				const rows = db
					.prepare(`SELECT id, chat_id, sender_id, from_me, type, text, reply_to_id, timestamp, push_name
                    FROM messages
                    WHERE text LIKE ?
                    ORDER BY timestamp DESC
                    LIMIT ?`)
					.all(
						`%${query}%`,
						limit,
					) as import("../../services/message-store.js").MessageRow[];

				const result = rows.map((r) => ({
					id: r.id,
					chatId: r.chat_id,
					chatName: contacts.chatName(r.chat_id) ?? jidLabel(r.chat_id),
					senderId: r.sender_id,
					senderName: contacts.displayName(r.sender_id) ?? r.push_name ?? null,
					fromMe: r.from_me === 1,
					type: r.type,
					text: r.text ?? null,
					replyToId: r.reply_to_id ?? null,
					timestamp: new Date(r.timestamp).toISOString(),
				}));

				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} finally {
				db.close();
			}
		},
	);

	// 4. list_contacts
	server.registerTool(
		"list_contacts",
		{
			description:
				"List known WhatsApp contacts with names, aliases, and phone numbers.",
			inputSchema: {
				query: z
					.string()
					.optional()
					.describe("Optional search query to filter contacts"),
			},
		},
		async ({ query }) => {
			const db = openDatabase(config);
			try {
				const store = new ContactStore(db);
				const rows = store.list(query);
				const result = rows.map((r) => ({
					jid: r.jid,
					name: r.name ?? null,
					alias: r.alias ?? null,
					phone: r.phone ?? null,
					pushName: r.push_name ?? null,
				}));
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} finally {
				db.close();
			}
		},
	);

	// 5. get_connection_status
	server.registerTool(
		"get_connection_status",
		{
			description:
				"Check the current WhatsApp connection state and daemon status.",
		},
		async () => {
			const db = openDatabase(config);
			try {
				const { state } = await useSqliteAuthState(db);
				const hasSession =
					state.creds.registered || Boolean(state.creds.me?.id);
				if (!hasSession) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										connected: false,
										status: "not_logged_in",
										message:
											"User is not logged in. Run 'wacli login' in terminal.",
									},
									null,
									2,
								),
							},
						],
					};
				}

				const ipc = new IpcClient(config.ipcPath);
				const daemonAlive = await ipc.alive();
				let daemonPing: Record<string, unknown> | null = null;
				if (daemonAlive) {
					try {
						daemonPing = (await ipc.request("ping", {}, 3000)) as Record<
							string,
							unknown
						>;
					} catch {}
				}

				const me = state.creds.me;
				const isConnected = daemonPing?.connectionState === "connected";

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									connected: isConnected,
									status:
										daemonPing?.connectionState ??
										(daemonAlive ? "connected" : "daemon_offline"),
									daemon: daemonAlive,
									user: me?.id ? phoneFromJid(me.id) : null,
									userName: me?.name ?? null,
									daemonPing,
								},
								null,
								2,
							),
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);
}
