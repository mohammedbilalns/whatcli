import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { openDatabase } from "../../db/database.js";
import { IpcClient } from "../../ipc/client.js";
import { IpcSender } from "../../ipc/ipc-sender.js";
import { MessageService } from "../../services/message-service.js";
import { MessageStore } from "../../services/message-store.js";
import type { Config } from "../../utils/config.js";
import { resolveChat } from "../../whatsapp/jid.js";

async function getSenderService(
	config: Config,
	db: import("better-sqlite3").Database,
): Promise<MessageService> {
	const ipc = new IpcClient(config.ipcPath);
	if (!(await ipc.alive())) {
		throw new Error(
			"WhatsApp daemon is not running. Please start 'wacli daemon' to enable messaging.",
		);
	}
	const store = new MessageStore(db);
	return new MessageService(new IpcSender(ipc), store);
}

export function registerActionTools(server: McpServer, config: Config): void {
	// 1. send_message
	server.registerTool(
		"send_message",
		{
			description: "Send a text message to a WhatsApp contact or group.",
			inputSchema: {
				recipient: z
					.string()
					.describe(
						"Target chat name, phone number, or JID (e.g. 'Alice', '+919876543210')",
					),
				text: z.string().describe("Message text to send"),
			},
		},
		async ({ recipient, text }) => {
			const db = openDatabase(config);
			try {
				const resolved = resolveChat(db, recipient);
				if (!resolved.ok) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `Cannot resolve recipient "${recipient}". Please use list_chats or list_contacts to verify.`,
							},
						],
					};
				}

				const service = await getSenderService(config, db);
				const sent = await service.sendText(resolved.jid, text);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									messageId: sent.id,
									to: resolved.label,
									jid: resolved.jid,
									timestamp: sent.timestamp.toISOString(),
								},
								null,
								2,
							),
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Send failed: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);

	// 2. send_reply
	server.registerTool(
		"send_reply",
		{
			description: "Reply to a specific message in a WhatsApp chat.",
			inputSchema: {
				chat: z.string().describe("Chat name or JID where the message exists"),
				messageId: z.string().describe("ID of the target message to reply to"),
				text: z.string().describe("Reply text content"),
			},
		},
		async ({ chat, messageId, text }) => {
			const db = openDatabase(config);
			try {
				const resolved = resolveChat(db, chat);
				if (!resolved.ok) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `Cannot resolve chat "${chat}".`,
							},
						],
					};
				}

				const store = new MessageStore(db);
				const targetMsg = store.getMessageById(messageId);
				if (!targetMsg) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `Message with ID "${messageId}" was not found in stored history.`,
							},
						],
					};
				}

				const service = await getSenderService(config, db);
				const sent = await service.sendReply(
					resolved.jid,
					{
						id: targetMsg.id,
						fromMe: targetMsg.from_me === 1,
						senderId: targetMsg.sender_id,
						text: targetMsg.text ?? undefined,
					},
					text,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									replyId: sent.id,
									targetMessageId: messageId,
									chat: resolved.label,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Reply failed: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);

	// 3. send_reaction
	server.registerTool(
		"send_reaction",
		{
			description:
				"React to a WhatsApp message with an emoji (or pass empty string '' to remove reaction).",
			inputSchema: {
				chat: z.string().describe("Chat name or JID where the message exists"),
				messageId: z.string().describe("ID of the target message to react to"),
				emoji: z
					.string()
					.describe(
						"Single emoji character (e.g. '👍', '❤️'), or empty string to remove",
					),
			},
		},
		async ({ chat, messageId, emoji }) => {
			const db = openDatabase(config);
			try {
				const resolved = resolveChat(db, chat);
				if (!resolved.ok) {
					return {
						isError: true,
						content: [{ type: "text", text: `Cannot resolve chat "${chat}".` }],
					};
				}

				const store = new MessageStore(db);
				const targetMsg = store.getMessageById(messageId);
				if (!targetMsg) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `Message with ID "${messageId}" was not found.`,
							},
						],
					};
				}

				const service = await getSenderService(config, db);
				await service.sendReaction(
					resolved.jid,
					{
						id: targetMsg.id,
						fromMe: targetMsg.from_me === 1,
						senderId: targetMsg.sender_id,
						text: targetMsg.text ?? undefined,
					},
					emoji,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									targetMessageId: messageId,
									reaction: emoji,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Reaction failed: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);

	// 4. lookup_phone
	server.registerTool(
		"lookup_phone",
		{
			description:
				"Check if a phone number has a WhatsApp account and find its JID.",
			inputSchema: {
				phone: z
					.string()
					.describe(
						"Full phone number in international format (e.g. '15551234567')",
					),
			},
		},
		async ({ phone }) => {
			const db = openDatabase(config);
			try {
				const service = await getSenderService(config, db);
				const digits = phone.replace(/\D/g, "");
				const results = await service.lookupPhone(digits);
				return {
					content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Lookup failed: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);
}
