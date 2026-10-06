import {
	type AuthenticationCreds,
	type AuthenticationState,
	BufferJSON,
	initAuthCreds,
} from "@whiskeysockets/baileys";
import type { Database } from "better-sqlite3";

export async function useSqliteAuthState(
	db: Database,
): Promise<{ state: AuthenticationState; saveCreds: () => void }> {
	const selectStmt = db.prepare("SELECT data FROM auth_state WHERE name = ?");
	const insertStmt = db.prepare(`
    INSERT INTO auth_state (name, data) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET data = excluded.data
  `);
	const deleteStmt = db.prepare("DELETE FROM auth_state WHERE name = ?");

	const readData = (name: string) => {
		try {
			const row = selectStmt.get(name) as { data: string } | undefined;
			if (row) {
				return JSON.parse(row.data, BufferJSON.reviver);
			}
		} catch (_error) {
			// return null below
		}
		return null;
	};

	const writeData = (name: string, data: unknown) => {
		insertStmt.run(name, JSON.stringify(data, BufferJSON.replacer));
	};

	const creds: AuthenticationCreds = readData("creds") || initAuthCreds();

	return {
		state: {
			creds,
			keys: {
				get: async (type, ids) => {
					const data: { [id: string]: unknown } = {};
					for (const id of ids) {
						const value = readData(`${type}-${id}`);
						if (value !== null) {
							data[id] = value;
						}
					}
					return data;
				},
				set: async (data) => {
					const applySet = db.transaction((txData) => {
						for (const category of Object.keys(txData)) {
							const keys = (txData as Record<string, Record<string, unknown>>)[
								category
							];
							for (const id of Object.keys(keys)) {
								const value = keys[id];
								const name = `${category}-${id}`;
								if (value) {
									insertStmt.run(
										name,
										JSON.stringify(value, BufferJSON.replacer),
									);
								} else {
									deleteStmt.run(name);
								}
							}
						}
					});
					applySet(data);
				},
			},
		},
		saveCreds: () => {
			writeData("creds", creds);
		},
	};
}
