import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { ContactStore } from "../services/contact-store.js";
import { loadConfig } from "../utils/config.js";
import { printInfo, printJson, printTable } from "../utils/output.js";

interface ContactsOptions {
	json?: boolean;
	plain?: boolean;
}

export function registerContactsCommand(program: Command): void {
	program
		.command("contacts [query]")
		.description("List known contacts (alias > name > identifier)")
		.option("--json", "output contacts as JSON")
		.option("--plain", "output plain tab-separated values without formatting")
		.action((query: string | undefined, opts: ContactsOptions) =>
			contactsList(query, opts),
		);
}

function contactsList(
	query: string | undefined,
	opts: ContactsOptions = {},
): void {
	const db = openDatabase(loadConfig());
	const rows = new ContactStore(db).list(query);
	db.close();

	if (opts.json) {
		const jsonOutput = rows.map((r) => ({
			jid: r.jid,
			name: r.name ?? null,
			alias: r.alias ?? null,
			phone: r.phone ?? null,
			pushName: r.push_name ?? null,
		}));
		printJson(jsonOutput);
		return;
	}

	if (rows.length === 0) {
		printInfo(
			query ? `No contacts matching "${query}".` : "No named contacts yet.",
		);
		return;
	}

	const tableData = rows.map((r) => {
		const name = (r.alias ?? r.name ?? "").slice(0, 26);
		return [name, r.phone ?? r.jid];
	});

	printTable(["NAME", "IDENTIFIER"], tableData, { plain: opts.plain });
}
