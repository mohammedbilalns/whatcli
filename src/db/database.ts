import { mkdirSync } from "node:fs";
import { Config } from "../utils/config.js";
import Database from "better-sqlite3";
import path from "node:path";

export function openDatabase(config : Config) : Database.Database {
  mkdirSync(path.dirname(config.dbPath), {recursive: true})
  const db = new Database(config.dbPath)
  db.pragma('jounal_mode = WAL' )
  return db 
}


