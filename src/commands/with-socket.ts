import type { WASocket } from "@whiskeysockets/baileys";
import type { Database } from "better-sqlite3";
import { openDatabase } from "../db/database.js";
import { IpcClient } from "../ipc/client.js";
import { IpcSender } from "../ipc/ipc-sender.js";
import { MessageService } from "../services/message-service.js";
import { MessageStore } from "../services/message-store.js";
import type { Config } from "../utils/config.js";
import { loadConfig } from "../utils/config.js";
import { printError } from "../utils/output.js";
import { WhatsAppClient } from "../whatsapp/client.js";
import { connectAndWait } from "../whatsapp/connect.js";
import { type Resolution, resolveChat } from "../whatsapp/jid.js";
import { loadSession } from "../whatsapp/session.js";

/** Thrown for user-facing errors (bad name, missing message) — printed, exit 1. */
export class UserError extends Error {}

/** Resolve a name to a chat or throw a friendly UserError. */
export function resolveOrThrow(
	db: Database,
	name: string,
): Extract<Resolution, { ok: true }> {
	const r = resolveChat(db, name);
	if (r.ok) return r;
	if (r.error === "not-found")
		throw new UserError(`No chat matching "${name}" found. Run "wacli chats".`);
	const lines = r.candidates.map((c) => `  ${c.label}   (${c.jid})`).join("\n");
	throw new UserError(
		`"${name}" matches several chats — be more specific:\n${lines}`,
	);
}

/** Connect, run fn with a ready service, always tear down cleanly. */
export async function withSocket(
	fn: (ctx: {
		sock?: WASocket;
		service: MessageService;
		store: MessageStore;
		db: Database;
		config: Config;
	}) => Promise<void> | void,
	opts: { syncHistory?: boolean } = {},
): Promise<void> {
	const config = loadConfig();
	const db = openDatabase(config);
	const ipc = new IpcClient(config.ipcPath);

	if (await ipc.alive()) {
		try {
			const store = new MessageStore(db);
			const service = new MessageService(new IpcSender(ipc), store);
			await fn({ service, store, db, config });
			db.close();
			return;
		} catch (err) {
			if (!(err instanceof UserError)) throw err; // UserError prints below as usual
			printError(err.message);
			process.exit(1);
		}
	}

	const session = await loadSession(db);
	if (!session.hasSession) {
		printError('Not logged in — run "wacli login" first.');
		db.close();
		process.exit(1);
	}

	const store = new MessageStore(db);
	const { sock, outcome } = await connectAndWait(
		session.state,
		session.saveCreds,
		{ timeoutMs: 30_000 },
		async (key) => store.getRawMessage(key.id as string),
	);
	if (outcome.status !== "connected") {
		const why =
			outcome.status === "timeout" ? "timed out" : `code ${outcome.code}`;
		printError(`Could not reach WhatsApp (${why}).`);
		db.close();
		process.exit(1);
	}

	try {
		try {
			if (opts.syncHistory) {
				const ora = (await import("ora")).default;
				const spinner = ora().start();
				const { waitForHistorySync } = await import("../whatsapp/history.js");
				await waitForHistorySync(sock, db, spinner);
			}

			const service = new MessageService(new WhatsAppClient(sock), store);
			await fn({ sock, service, store, db, config });
		} finally {
			await sock.end(undefined);
			await session.saveCreds();
			db.close();
		}
	} catch (err) {
		if (err instanceof UserError) {
			printError(err.message);
			process.exit(1);
		}
		printError(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
	}
}
