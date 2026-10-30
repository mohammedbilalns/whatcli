import process from "node:process";
import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { ContactStore } from "../services/contact-store.js";
import { MessageStore } from "../services/message-store.js";
import { loadConfig } from "../utils/config.js";
import { formatMessage } from "../utils/format.js";
import {
	printData,
	printError,
	printInfo,
	printJson,
} from "../utils/output.js";
import { resolveChat } from "../whatsapp/jid.js";

interface HistoryOptions {
	limit?: string;
	ids?: boolean;
	json?: boolean;
}

export function registerHistoryCommand(program: Command): void {
	program
		.command("history <name>")
		.description("Show stored message history for a chat")
		.option("-n, --limit <number>", "max messages to show", "50")
		.option("--ids", "show message IDs (targets for reply/react)")
		.option("--json", "output messages as JSON")
		.action((name: string, opts: HistoryOptions) => history(name, opts));
}

function history(name: string, opts: HistoryOptions): void {
	const limit = Number(opts.limit) || 50;
	const db = openDatabase(loadConfig());

	const resolved = resolveChat(db, name);
	if (!resolved.ok) {
		if (resolved.error === "not-found") {
			printError(`No chat matching "${name}" found. Run "wacli chats".`);
		} else {
			printError(`"${name}" matches several chats — be more specific:`);
			for (const c of resolved.candidates) {
				printError(`  ${c.label}   (${c.jid})`);
			}
		}
		db.close();
		process.exit(1);
	}

	const store = new MessageStore(db);
	const contacts = new ContactStore(db);
	const messages = store.listMessages(resolved.jid, limit);
	const resolveName = (jid: string) => contacts.displayName(jid);

	if (opts.json) {
		const jsonOutput = messages.map((m) => ({
			id: m.id,
			chatId: m.chatId,
			senderId: m.senderId,
			senderName: resolveName(m.senderId) ?? m.pushName ?? null,
			fromMe: m.fromMe,
			type: m.type,
			text: m.text ?? null,
			replyToId: m.replyToId ?? null,
			timestamp: m.timestamp.toISOString(),
		}));
		printJson(jsonOutput);
		db.close();
		return;
	}

	if (process.stdout.isTTY) {
		printInfo(resolved.label);
		printInfo("─".repeat(50));
	}

	if (messages.length === 0) {
		printInfo("No stored messages for this chat.");
		printInfo(
			"(Only messages seen while watching, plus history sync, are stored.)",
		);
		db.close();
		return;
	}

	for (const m of messages) {
		const formatted = formatMessage(m, resolveName);
		printData(opts.ids ? `${m.id}\t${formatted}` : formatted);
	}

	db.close();
}
