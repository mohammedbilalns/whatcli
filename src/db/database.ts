import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Config } from "../utils/config.js";
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
	db.pragma("busy_timeout = 5000");
	db.pragma("cache_size = -64000"); // 64 MB page cache
	migrate(db);
	return db;
}
