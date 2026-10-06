import { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { ContactStore } from "../services/contact-store.js";
import { loadConfig } from "../utils/config.js";
import { printTable, printInfo } from '../utils/output.js';

export function registerContactsCommand(program: Command): void {
  program
    .command('contacts [query]')
    .description('List known contacts (alias > name > identifier)')
    .action((query?: string) => contactsList(query));
}

import { withSocket } from './with-socket.js';

function contactsList(query?: string): Promise<void> {
  return withSocket(({ db }) => {
    const rows = new ContactStore(db).list(query);
    
    if (rows.length === 0) {
      printInfo(query ? `No contacts matching "${query}".` : 'No named contacts yet.');
      return;
    }
    
    const tableData = rows.map(r => {
      const name = (r.alias ?? r.name ?? '').slice(0, 26);
      return [name, r.phone ?? r.jid];
    });
    
    printTable(['NAME', 'IDENTIFIER'], tableData);
  }, { syncHistory: true });
}
