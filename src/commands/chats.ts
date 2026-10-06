import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { jidLabel } from '../whatsapp/jid.js';
import { timeAgo } from '../utils/time.js';
import { printTable, printInfo } from '../utils/output.js';

export function registerChatsCommand(program: Command): void {
  program
    .command('chats')
    .description('List locally stored chats')
    .action(() => chats());
}

function chats(): void {
  const config = loadConfig();
  const db = openDatabase(config);
  const rows = new MessageStore(db).listChats();
  db.close();

  if (rows.length === 0) {
    printInfo('No chats stored yet.');
    printInfo('Run "wacli watch" — history sync will populate the database.');
    return; 
  }

  const tableData = rows.map(row => {
    const name = (row.name ?? jidLabel(row.jid)).slice(0, 24);
    const last = row.last_message_at ? timeAgo(new Date(row.last_message_at)) : '—';
    return [String(row.id), row.type, name, last];
  });
  
  printTable(['ID', 'TYPE', 'NAME', 'LAST MESSAGE'], tableData);
}
