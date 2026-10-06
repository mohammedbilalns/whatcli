import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { MessageStore } from "../services/message-store.js";
import { loadConfig } from "../utils/config.js";
import { printInfo, printTable } from "../utils/output.js";
import { timeAgo } from "../utils/time.js";
import { jidLabel } from "../whatsapp/jid.js";

export function registerChatsCommand(program: Command): void {
	program
		.command("chats")
		.description("List locally stored chats")
		.action(() => chats());
}

import pc from "picocolors";
export async function chats(): Promise<void> {
	const config = loadConfig();
	const db = openDatabase(config);
	const store = new MessageStore(db);
	const rows = store.listChats();

	if (rows.length === 0) {
		printInfo("No chats stored yet.");
		printInfo('Run "wacli daemon" — history sync will populate the database.');
		db.close();
		return;
	}

	const tableData = rows.map((row) => {
		const name = (row.name ?? jidLabel(row.jid)).slice(0, 24);
		const last = row.last_message_at
			? timeAgo(new Date(row.last_message_at))
			: "—";
		const typeStr =
			row.type === "group" ? pc.magenta("group") : pc.cyan("direct");
		return [String(row.id), typeStr, name, last];
	});

	printTable(["ID", "TYPE", "NAME", "LAST MESSAGE"], tableData, {
		padding: true,
	});
	db.close();
}
