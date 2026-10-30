import { DisconnectReason } from "@whiskeysockets/baileys";
import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { loadConfig } from "../utils/config.js";
import {
	printError,
	printInfo,
	printJson,
	printSuccess,
} from "../utils/output.js";
import { useSqliteAuthState } from "../whatsapp/auth.js";
import { connectAndWait } from "../whatsapp/connect.js";

interface LogoutOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerLogoutCommand(program: Command): void {
	program
		.command("logout")
		.description("Log out this device and delete the saved session")
		.option("-q, --quiet", "suppress output")
		.option("--json", "output result as JSON")
		.action((opts: LogoutOptions) => logout(opts));
}

async function logout(opts: LogoutOptions = {}): Promise<void> {
	const config = loadConfig();
	const db = openDatabase(config);
	const { state, saveCreds } = await useSqliteAuthState(db);

	const hasSession = state.creds.registered || Boolean(state.creds.me?.id);
	if (!hasSession) {
		db.close();
		if (opts.json) {
			printJson({ loggedOut: true, status: "not_logged_in" });
			process.exit(0);
		}
		printInfo("Not logged in — nothing to do.");
		process.exit(0);
	}

	if (!opts.quiet && !opts.json) {
		printInfo("Logging out…");
	}
	const { sock, outcome } = await connectAndWait(state, saveCreds, {
		timeoutMs: 30_000,
	});

	if (outcome.status === "connected") {
		try {
			await sock.logout();
		} catch {
			if (!opts.quiet && !opts.json) {
				printError(
					"WhatsApp did not confirm the logout (session already invalid?).",
				);
			}
		}
	} else if (
		outcome.status === "closed" &&
		outcome.code === DisconnectReason.loggedOut
	) {
		if (!opts.quiet && !opts.json) {
			printInfo("Session was already invalidated (logged out from the phone).");
		}
	}

	db.prepare("DELETE FROM auth_state").run();
	db.close();

	if (opts.json) {
		printJson({ loggedOut: true, status: "success" });
		process.exit(0);
	}

	printSuccess("Logged out. Local credentials deleted.", opts.quiet);
	process.exit(0);
}
