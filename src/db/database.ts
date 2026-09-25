import { mkdirSync } from "node:fs";
import { Config } from "../utils/config.js";
import Database from "better-sqlite3";
import path from "node:path";

/**
 * Opens and configures the SQLite database.
 */
export function openDatabase(config : Config) : Database.Database {

  // Create the database directory if it doesn't exist.
  mkdirSync(path.dirname(config.dbPath), {recursive: true})


  // Open the SQLite database. Creates the file if it doesn't exist.
  const db = new Database(config.dbPath)

  // Enable Write ahead logging mode for better read/write concurrency.
  db.pragma('jounal_mode = WAL' )
  return db 
}


