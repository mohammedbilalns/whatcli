import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { ContactStore } from "../services/contact-store.js";
import { loadConfig } from "../utils/config.js";
import {
	printData,
	printError,
	printInfo,
	printJson,
	printSuccess,
} from "../utils/output.js";
import { resolveChat } from "../whatsapp/jid.js";
import { withSocket } from "./with-socket.js";

interface ContactActionOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerContactCommand(program: Command): void {
	const contact = program.command("contact").description("Contact operations");
	contact
		.command("rename <target> <alias...>")
		.description(
			'Set a local alias (empty "" clears). Alias wins over every other name.',
		)
		.option("-q, --quiet", "suppress output")
		.option("--json", "output result as JSON")
		.action(
			(target: string, aliasParts: string[], opts: ContactActionOptions) =>
				rename(target, aliasParts.join(" "), opts),
		);
	contact
		.command("lookup <phone>")
		.description(
			"Live lookup: does this number have WhatsApp, and what are its JIDs?",
		)
		.option("--json", "output lookup results as JSON")
		.action((phone: string, opts: ContactActionOptions) => lookup(phone, opts));
}

async function rename(
	target: string,
	alias: string,
	opts: ContactActionOptions,
): Promise<void> {
	const db = openDatabase(loadConfig());
	const store = new ContactStore(db);
	const clean = alias.trim() || null;

	let row = store.byJid(target);
	if (!row) {
		const found = store.findByText(target);
		const chatsHit = resolveChat(db, target);
		const jid =
			found.length === 1
				? found[0]?.jid
				: chatsHit?.ok
					? chatsHit.jid
					: undefined;
		if (!jid) {
			printError(`Nothing matching "${target}".`);
			db.close();
			process.exit(1);
		}
		db.prepare("INSERT OR IGNORE INTO contacts (jid) VALUES (?)").run(jid);
		row = store.byJid(jid);
	}
	if (!row?.jid) {
		printError(`Failed to resolve contact for "${target}".`);
		db.close();
		process.exit(1);
	}

	store.setAlias(row.jid, clean);
	db.close();

	if (opts.json) {
		printJson({
			jid: row.jid,
			alias: clean,
			status: clean ? "aliased" : "cleared",
		});
		return;
	}

	const msg = clean
		? `${row.jid} → "${clean}"`
		: `alias cleared for ${row.jid}`;
	printSuccess(msg, opts.quiet);
}

async function lookup(
	phone: string,
	opts: ContactActionOptions,
): Promise<void> {
	const digits = phone.replace(/\D/g, "");
	if (digits.length < 10) {
		printError(
			"That does not look like a phone number (use full international format).",
		);
		process.exit(1);
	}
	await withSocket(async ({ service }) => {
		const results = await service.lookupPhone(digits);
		if (opts.json) {
			printJson(results ?? []);
			return;
		}

		if (!results || results.length === 0) {
			printInfo("No WhatsApp account for that number.");
			return;
		}
		for (const r of results) {
			printData(`jid:    ${r.jid}`);
			if ("lid" in r && r.lid) printData(`lid:    ${r.lid}`);
			printData(`exists: ${r.exists}`);
		}
	});
}
