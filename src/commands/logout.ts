import { DisconnectReason } from "@whiskeysockets/baileys";
import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { loadConfig } from "../utils/config.js";
import { useSqliteAuthState } from "../whatsapp/auth.js";
import { connectAndWait } from "../whatsapp/connect.js";

export function registerLogoutCommand(program: Command): void {
	program
		.command("logout")
		.description("Log out this device and delete the saved session")
		.action(() => logout());
}

async function logout(): Promise<void> {
	const config = loadConfig();
	const db = openDatabase(config);
	const { state, saveCreds } = await useSqliteAuthState(db);

	const hasSession = state.creds.registered || !!state.creds.me?.id;
	if (!hasSession) {
		console.log("Not logged in — nothing to do.");
		process.exit(0);
	}

	console.log("Logging out…");
	const { sock, outcome } = await connectAndWait(state, saveCreds, {
		timeoutMs: 30_000,
	});

	if (outcome.status === "connected") {
		try {
			await sock.logout(); // server-side: tells WhatsApp to unlink this device
		} catch {
			console.log(
				"WhatsApp did not confirm the logout (session already invalid?).",
			);
			console.log(
				"If this device still shows under Linked Devices, remove it on the phone.",
			);
		}
	} else if (
		outcome.status === "closed" &&
		outcome.code === DisconnectReason.loggedOut
	) {
		console.log("Session was already invalidated (logged out from the phone).");
	} else {
		const code = outcome.status === "closed" ? outcome.code : "timeout";
		console.log(`Could not reach WhatsApp (code ${code}).`);
		console.log(
			"Removing the local session anyway — check Linked Devices on the phone",
		);
		console.log("if this device still appears there.");
	}

	db.prepare("DELETE FROM auth_state").run();
	db.close();
	console.log("\n Logged out. Local credentials deleted.");
	console.log('Run "wacli login" to connect again.');
	process.exit(0);
}
