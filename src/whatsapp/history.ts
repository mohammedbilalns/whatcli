import {
	type WASocket,
	isJidStatusBroadcast,
	isJidNewsletter,
} from "@whiskeysockets/baileys";
import type { Message } from "../models/message.js";
import { parseMessage } from "./parser.js";

export interface HistoryChat {
	jid: string;
	name?: string;
}
export interface HistoryContact {
	jid: string;
	name?: string;
	notify?: string;
	verifiedName?: string;
}

export interface HistoryBatch {
	chats: HistoryChat[];
	contacts: HistoryContact[];
	messages: Message[];
}

function skip(jid: string): boolean {
	return Boolean(!jid || isJidStatusBroadcast(jid) || isJidNewsletter(jid));
}

export function registerHistorySync(
	sock: WASocket,
	onHistory: (batch: HistoryBatch) => void,
): void {
	sock.ev.on("messaging-history.set", (sync) => {
		const messages: Message[] = [];
		for (const raw of sync.messages ?? []) {
			if (skip(raw.key?.remoteJid ?? "")) continue;
			const result = parseMessage(raw);
			if (result.ok) messages.push(result.message);
		}

		onHistory({
			chats: (sync.chats ?? [])
				.map((c) => ({ jid: String(c.id), name: c.name ?? undefined }))
				.filter((c) => !skip(c.jid)),
			contacts: (sync.contacts ?? [])
				.map((c: any) => ({
					jid: String(c.id),
					name: c.name ?? undefined,
					notify: c.notify ?? undefined,
					verifiedName: c.verifiedName ?? undefined,
				}))
				.filter((c) => !skip(c.jid)),
			messages,
		});
	});
}

import type { Database } from "better-sqlite3";
import { MessageStore } from "../services/message-store.js";
import { ContactStore } from "../services/contact-store.js";

export async function waitForHistorySync(
	sock: WASocket,
	db: Database,
	spinner?: any,
): Promise<void> {
	const store = new MessageStore(db);
	const contactsStore = new ContactStore(db);

	let historyReceived = false;
	let totalMessages = 0;
	let totalChats = 0;
	let totalContacts = 0;

	if (spinner) spinner.start("Syncing history... (this may take a moment)");

	// This listener just makes sure we catch basic profile updates if they arrive during sync.
	const handleUpsert = (contacts_arr: any[]) => {
		for (const c of contacts_arr) {
			const name = c.name || c.notify || c.verifiedName;
			if (c.id && name) contactsStore.upsertName(c.id, name);
		}
	};
	sock.ev.on("contacts.upsert", handleUpsert);

	await new Promise<void>((resolve) => {
		let timeout = setTimeout(resolve, 15000);

		registerHistorySync(sock, (batch) => {
			historyReceived = true;
			const stored = store.ingestHistory(batch);
			totalMessages += stored;
			totalChats += batch.chats.length;
			totalContacts += batch.contacts.length;
			if (spinner)
				spinner.text = `Syncing... ${totalMessages} messages, ${totalChats} chats, ${totalContacts} contacts`;

			clearTimeout(timeout);
			timeout = setTimeout(resolve, 3000);
		});
	});

	sock.ev.off("contacts.upsert", handleUpsert);

	if (spinner) {
		if (historyReceived) {
			spinner.succeed(
				`Sync complete: ${totalMessages} messages, ${totalChats} chats, ${totalContacts} contacts`,
			);
		} else {
			spinner.succeed("Connected (No immediate history received).");
		}
	}
}
