import { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { ContactStore } from "../services/contact-store.js";
import { loadConfig } from "../utils/config.js";

export function registerContactsCommand(program: Command): void {
  program
    .command('contacts [query]')
    .description('List known contacts (alias > name > identifier)')
    .action((query?: string) => contactsList(query));
}

function contactsList(query?: string): void {
  const db = openDatabase(loadConfig());
  const rows = new ContactStore(db).list(query);
  db.close();
  if (rows.length === 0) { console.log(query ? `No contacts matching "${query}".` : 'No named contacts yet.'); return; }
  console.log(`${'NAME'.padEnd(28)}IDENTIFIER`);
  console.log('─'.repeat(48));
  for (const r of rows) {
    const name = (r.alias ?? r.name ?? '').slice(0, 26);
    const id = r.alias ? `(aliased) ` : '' + (r.phone ?? r.jid);
    console.log(`${name.padEnd(28)}${r.phone ?? r.jid}`);
  }
}
