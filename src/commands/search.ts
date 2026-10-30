import process from "node:process";
import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { ContactStore } from "../services/contact-store.js";
import { loadConfig } from "../utils/config.js";
import { formatMessage } from "../utils/format.js";
import { printData, printInfo, printJson } from "../utils/output.js";
import { jidLabel } from "../whatsapp/jid.js";

interface SearchOptions {
	json?: boolean;
}

export function registerSearchCommand(program: Command): void {
	program
		.command("search <text>")
		.description("Search stored message text")
		.option("--json", "output search results as JSON")
		.action((text: string, opts: SearchOptions) => handleSearch(text, opts));
}

function handleSearch(text: string, opts: SearchOptions): void {
	const db = openDatabase(loadConfig());
	const contacts = new ContactStore(db);
	const rows = db
		.prepare(`SELECT id, chat_id, sender_id, from_me, type, text, reply_to_id, timestamp, push_name
                  FROM messages
                  WHERE text LIKE ?
                  ORDER BY timestamp DESC
                  LIMIT 100`)
		.all(`%${text}%`) as import("../services/message-store.js").MessageRow[];

	if (opts.json) {
		const jsonOutput = rows.map((row) => ({
			id: row.id,
			chatId: row.chat_id,
			chatLabel: contacts.chatName(row.chat_id) ?? jidLabel(row.chat_id),
			senderId: row.sender_id,
			senderName: contacts.displayName(row.sender_id) ?? row.push_name ?? null,
			fromMe: row.from_me === 1,
			type: row.type,
			text: row.text ?? null,
			replyToId: row.reply_to_id ?? null,
			timestamp: new Date(row.timestamp).toISOString(),
		}));
		printJson(jsonOutput);
		db.close();
		return;
	}

	if (rows.length === 0) {
		printInfo(`No stored messages matching "${text}".`);
		db.close();
		process.exit(1);
	}

	const separator = process.stdout.isTTY ? " │ " : "\t";

	for (const row of rows) {
		const chatLabel = contacts.chatName(row.chat_id) ?? jidLabel(row.chat_id);
		const msg = {
			id: row.id,
			chatId: row.chat_id,
			senderId: row.sender_id,
			fromMe: row.from_me === 1,
			timestamp: new Date(row.timestamp),
			type: row.type as import("../models/message.js").MessageType,
			text: row.text ?? undefined,
			replyToId: row.reply_to_id ?? undefined,
			pushName: row.push_name ?? undefined,
		};

		const formatted = formatMessage(msg, (j) => contacts.displayName(j));
		printData(`${chatLabel}${separator}${formatted}`);
	}
	db.close();
}
