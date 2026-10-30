import process from "node:process";
import { DisconnectReason } from "@whiskeysockets/baileys";
import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { IpcClient } from "../ipc/client.js";
import { loadConfig } from "../utils/config.js";
import { printData, printError, printJson } from "../utils/output.js";
import { useSqliteAuthState } from "../whatsapp/auth.js";
import { connectAndWait } from "../whatsapp/connect.js";
import { phoneFromJid } from "../whatsapp/jid.js";

interface StatusOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerStatusCommand(program: Command): void {
	program
		.command("status")
		.description("Show Whatsapp connection status")
		.option("-q, --quiet", "silent check; exit code 0 if connected, 1 if not")
		.option("--json", "output status as JSON")
		.action((opts: StatusOptions) => status(opts));
}

/**
 * Checks the current WhatsApp connection status.
 */
async function status(opts: StatusOptions): Promise<void> {
	const config = loadConfig();
	const db = openDatabase(config);
	let dbClosed = false;

	const closeDb = () => {
		if (!dbClosed) {
			db.close();
			dbClosed = true;
		}
	};

	try {
		const { state, saveCreds } = await useSqliteAuthState(db);
		const hasSession = state.creds.registered || Boolean(state.creds.me?.id);

		if (!hasSession) {
			closeDb();
			if (opts.quiet) process.exit(1);
			if (opts.json) {
				printJson({
					connected: false,
					status: "not_logged_in",
					message: 'Run "wacli login" to connect.',
				});
				process.exit(1);
			}
			if (process.stdout.isTTY) {
				printData("Whatsapp\n--------------");
			}
			printError("Status: Not logged in");
			printError('Run "wacli login" to connect.');
			process.exit(1);
		}

		const ipc = new IpcClient(config.ipcPath);
		if (await ipc.alive()) {
			closeDb();
			if (opts.quiet) process.exit(0);
			if (opts.json) {
				const me = state.creds.me;
				printJson({
					connected: true,
					status: "connected",
					daemon: true,
					ipcPath: config.ipcPath,
					user: me?.id ? phoneFromJid(me.id) : null,
				});
				process.exit(0);
			}
			if (process.stdout.isTTY) {
				printData("Whatsapp\n--------------");
			}
			printData("Status: Connected (daemon)");
			printData(`Daemon: ${config.ipcPath}`);
			process.exit(0);
		}

		/*
		 * Try connecting to WhatsApp using the saved session.
		 */
		const { sock, outcome } = await connectAndWait(state, saveCreds, {
			timeoutMs: 30_000,
		});

		if (outcome.status === "connected") {
			const me = state.creds.me;
			await sock.end(undefined);
			closeDb();

			if (opts.quiet) process.exit(0);
			if (opts.json) {
				printJson({
					connected: true,
					status: "connected",
					daemon: false,
					user: me?.id ? phoneFromJid(me.id) : "unknown",
				});
				process.exit(0);
			}
			if (process.stdout.isTTY) {
				printData("Whatsapp\n--------------");
			}
			printData("Status: Connected");
			printData(`User: ${me?.id ? phoneFromJid(me.id) : "unknown"}`);
			process.exit(0);
		}

		closeDb();

		if (opts.quiet) process.exit(1);

		if (outcome.status === "timeout") {
			if (opts.json) {
				printJson({
					connected: false,
					status: "timeout",
					message: "Timed out reaching WhatsApp",
				});
				process.exit(1);
			}
			printError("Status: Offline (timed out reaching Whatsapp)");
			process.exit(1);
		}

		if (outcome.code === DisconnectReason.loggedOut) {
			const cleanupDb = openDatabase(config);
			cleanupDb.prepare("DELETE FROM auth_state").run();
			cleanupDb.close();

			if (opts.json) {
				printJson({
					connected: false,
					status: "logged_out",
					message: "Session invalidated from the phone",
				});
				process.exit(1);
			}
			printError("Status: Logged out (session invalidated from the phone)");
			printError("Local credentials deleted.");
			printError('Run "wacli login" to connect again.');
		} else {
			if (opts.json) {
				printJson({
					connected: false,
					status: "disconnected",
					code: outcome.code,
					reason: outcome.error?.message ?? "unknown",
				});
				process.exit(1);
			}
			printError(`Status: Disconnected (code ${outcome.code})`);
			printError(`Reason: ${outcome.error?.message ?? "unknown"}`);
		}
		process.exit(1);
	} finally {
		closeDb();
	}
}
