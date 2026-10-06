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

import { withSocket } from './with-socket.js';

export function chats(): Promise<void> {
  return withSocket(({ store }) => {
    const rows = store.listChats();

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
  }, { syncHistory: true });
}
