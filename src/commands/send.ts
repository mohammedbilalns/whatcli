import type { Command } from "commander";
import { Boom } from "@hapi/boom";
import { loadConfig } from "../utils/config.js";
import { openDatabase } from "../db/database.js";
import { MessageStore } from "../services/message-store.js";
import { MessageService } from "../services/message-service.js";
import { WhatsAppClient } from "../whatsapp/client.js";
import { resolveChat } from "../whatsapp/jid.js";
import { loadSession } from "../whatsapp/session.js";
import { connectAndWait } from "../whatsapp/connect.js";

export function registerSendCommand(program: Command): void {
	program
		.command("send <name> <text...>")
		.description("Send a text message to a chat")
		.action((name: string, text: string[]) => send(name, text.join(" ")));
}

async function send(name: string, text: string): Promise<void> {
	if (!text.trim()) {
		console.log("Message text is empty.");
		process.exit(1);
	}

	const config = loadConfig();
	const db = openDatabase(config);

	// 1. Resolve BEFORE any network — a typo shouldn't cost a 10s connect.
	const resolved = resolveChat(db, name);
	if (!resolved.ok) {
		if (resolved.error === "not-found") {
			console.log(`No chat matching "${name}" found. Run "wacli chats".`);
		} else {
			console.log(`"${name}" matches several chats — be more specific:`);
			for (const c of resolved.candidates)
				console.log(`  ${c.label}   (${c.jid})`);
		}
		db.close();
		process.exit(1);
	}

	// 2. Session check — same rule as status.
	const session = await loadSession(db);
	if (!session.hasSession) {
		console.log('Not logged in — run "wacli login" first.');
		db.close();
		process.exit(1);
	}

	// 3. Connect (discriminant-first, as logout taught us).
	const { sock, outcome } = await connectAndWait(
		session.state,
		session.saveCreds,
		{
			timeoutMs: 30_000,
		},
	);
	if (outcome.status !== "connected") {
		const why =
			outcome.status === "timeout" ? "timed out" : `code ${outcome.code}`;
		console.log(`Could not reach WhatsApp (${why}).`);
		db.close();
		process.exit(1);
	}

	// 4. Send via the service layer.
	try {
		const service = new MessageService(
			new WhatsAppClient(sock),
			new MessageStore(db),
		);
		const sent = await service.sendText(resolved.jid, text);
		console.log(`✅ Sent to ${resolved.label}`);
		console.log(`   id: ${sent.id}`); // Phase 8's reply/react will want this
	} catch (err) {
		const boom = err as Boom;
		const code = boom?.output?.statusCode ? ` (${boom.output.statusCode})` : "";
		console.log(
			`❌ Send failed${code}: ${err instanceof Error ? err.message : err}`,
		);
		process.exitCode = 1;
	} finally {
		await sock.end(undefined);
		await session.saveCreds();
		db.close();
	}
}
