import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { jidLabel } from '../whatsapp/jid.js';
import { timeAgo } from '../utils/time.js';

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
    console.log('No chats stored yet.');
    console.log('Run "wacli watch" — history sync will populate the database.');
    return; 
  }

  console.log(`${'ID'.padEnd(5)}${'TYPE'.padEnd(7)}${'NAME'.padEnd(26)}LAST MESSAGE`);
  console.log('─'.repeat(55));
  for (const row of rows) {
    const name = (row.name ?? jidLabel(row.jid)).slice(0, 24);
    const last = row.last_message_at ? timeAgo(new Date(row.last_message_at)) : '—';
    console.log(`${String(row.id).padEnd(5)}${row.type.padEnd(7)}${name.padEnd(26)}${last}`);
  }
}
