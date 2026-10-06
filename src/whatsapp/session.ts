import type { AuthenticationState } from "@whiskeysockets/baileys";
import type { Database } from "better-sqlite3";
import { useSqliteAuthState } from "./auth.js";

export interface Session {
	state: AuthenticationState;
	saveCreds: () => Promise<void> | void;
	hasSession: boolean;
}

export async function loadSession(db: Database): Promise<Session> {
	const { state, saveCreds } = await useSqliteAuthState(db);
	return {
		state,
		saveCreds,
		hasSession: state.creds.registered || !!state.creds.me?.id,
	};
}
