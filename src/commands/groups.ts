import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { MessageStore } from "../services/message-store.js";
import { loadConfig } from "../utils/config.js";
import { printInfo, printJson, printTable } from "../utils/output.js";
import { timeAgo } from "../utils/time.js";
import { jidLabel } from "../whatsapp/jid.js";

interface GroupsOptions {
	json?: boolean;
	plain?: boolean;
}

export function registerGroupsCommand(program: Command): void {
	program
		.command("groups")
		.description("List stored group chats")
		.option("--json", "output group chats as JSON")
		.option("--plain", "output plain tab-separated values without formatting")
		.action((opts: GroupsOptions) => groups(opts));
}

function groups(opts: GroupsOptions = {}): void {
	const db = openDatabase(loadConfig());
	const rows = new MessageStore(db).listGroups();
	db.close();

	if (opts.json) {
		const jsonOutput = rows.map((row) => ({
			jid: row.jid,
			name: row.name ?? jidLabel(row.jid),
			lastMessageAt: row.last_message_at
				? new Date(row.last_message_at).toISOString()
				: null,
		}));
		printJson(jsonOutput);
		return;
	}

	if (rows.length === 0) {
		printInfo('No groups stored yet — run "wacli daemon" to sync.');
		return;
	}

	const tableData = rows.map((row) => {
		const name = (row.name ?? jidLabel(row.jid)).slice(0, 30);
		const last = row.last_message_at
			? timeAgo(new Date(row.last_message_at))
			: "—";
		return [name, last];
	});

	printTable(["NAME", "LAST MESSAGE"], tableData, { plain: opts.plain });
}
