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

import pc from 'picocolors';
import { withSocket } from './with-socket.js';

export function chats(): Promise<void> {
  return withSocket(({ store }) => {
    const rows = store.listChats();

    if (rows.length === 0) {
      printInfo('No chats stored yet.');
      printInfo('Run "wacli daemon" — history sync will populate the database.');
      return; 
    }

    const directs = rows.filter(r => r.type === 'direct');
    const groups = rows.filter(r => r.type === 'group');

    const formatRow = (row: any) => {
      const name = (row.name ?? jidLabel(row.jid)).slice(0, 24);
      const last = row.last_message_at ? timeAgo(new Date(row.last_message_at)) : '—';
      return [String(row.id), row.type, name, last];
    };

    if (directs.length > 0) {
      console.log(pc.cyan('\n─── DIRECT CHATS ───'));
      printTable(['ID', 'TYPE', 'NAME', 'LAST MESSAGE'], directs.map(formatRow), { padding: true });
    }
    
    if (groups.length > 0) {
      console.log(pc.magenta('\n─── GROUP CHATS ───'));
      printTable(['ID', 'TYPE', 'NAME', 'LAST MESSAGE'], groups.map(formatRow), { padding: true });
    }
  }, { syncHistory: true });
}
