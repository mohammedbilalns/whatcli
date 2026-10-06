import { mkdirSync } from "node:fs";
import { Config } from "../utils/config.js";
import Database from "better-sqlite3";
import path from "node:path";
import { migrate } from "./migrate.js";

/**
 * Opens and configures the SQLite database.
 */
export function openDatabase(config: Config): Database.Database {
	mkdirSync(path.dirname(config.dbPath), { recursive: true });
	const db = new Database(config.dbPath);
	db.pragma("journal_mode = WAL");
	db.pragma("synchronous = NORMAL");
	db.pragma("temp_store = MEMORY");
	migrate(db);
	return db;
}
