import process from "node:process";
import type { Command } from "commander";
import pc from "picocolors";
import { openDatabase } from "../db/database.js";
import { MessageStore } from "../services/message-store.js";
import { loadConfig } from "../utils/config.js";
import { printInfo, printJson, printTable } from "../utils/output.js";
import { timeAgo } from "../utils/time.js";
import { jidLabel } from "../whatsapp/jid.js";

interface ChatsOptions {
	json?: boolean;
	plain?: boolean;
}

export function registerChatsCommand(program: Command): void {
	program
		.command("chats")
		.description("List locally stored chats")
		.option("--json", "output chats as JSON")
		.option("--plain", "output plain tab-separated values without formatting")
		.action((opts: ChatsOptions) => chats(opts));
}

export async function chats(opts: ChatsOptions = {}): Promise<void> {
	const config = loadConfig();
	const db = openDatabase(config);
	const store = new MessageStore(db);
	const rows = store.listChats();

	if (opts.json) {
		const jsonOutput = rows.map((row) => ({
			id: row.id,
			type: row.type,
			jid: row.jid,
			name: row.name ?? jidLabel(row.jid),
			lastMessageAt: row.last_message_at
				? new Date(row.last_message_at).toISOString()
				: null,
		}));
		printJson(jsonOutput);
		db.close();
		return;
	}

	if (rows.length === 0) {
		printInfo("No chats stored yet.");
		printInfo('Run "wacli daemon" — history sync will populate the database.');
		db.close();
		return;
	}

	const isTty = process.stdout.isTTY && !opts.plain;
	const tableData = rows.map((row) => {
		const name = (row.name ?? jidLabel(row.jid)).slice(0, 24);
		const last = row.last_message_at
			? timeAgo(new Date(row.last_message_at))
			: "—";
		const typeStr = isTty
			? row.type === "group"
				? pc.magenta("group")
				: pc.cyan("direct")
			: row.type;
		return [String(row.id), typeStr, name, last];
	});

	printTable(["ID", "TYPE", "NAME", "LAST MESSAGE"], tableData, {
		padding: true,
		plain: opts.plain,
	});
	db.close();
}
