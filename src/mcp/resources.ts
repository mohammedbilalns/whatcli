import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openDatabase } from "../db/database.js";
import { ContactStore } from "../services/contact-store.js";
import { MessageStore } from "../services/message-store.js";
import type { Config } from "../utils/config.js";

export function registerResources(server: McpServer, config: Config): void {
	server.registerResource(
		"whatsapp-chats",
		"whatsapp://chats",
		{
			description: "List of all locally known WhatsApp chats",
			mimeType: "application/json",
		},
		async (uri) => {
			const db = openDatabase(config);
			try {
				const store = new MessageStore(db);
				const rows = store.listChats();
				return {
					contents: [
						{
							uri: uri.href,
							text: JSON.stringify(rows, null, 2),
							mimeType: "application/json",
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);

	server.registerResource(
		"whatsapp-contacts",
		"whatsapp://contacts",
		{
			description: "List of all known WhatsApp contacts and aliases",
			mimeType: "application/json",
		},
		async (uri) => {
			const db = openDatabase(config);
			try {
				const store = new ContactStore(db);
				const rows = store.list();
				return {
					contents: [
						{
							uri: uri.href,
							text: JSON.stringify(rows, null, 2),
							mimeType: "application/json",
						},
					],
				};
			} finally {
				db.close();
			}
		},
	);
}
