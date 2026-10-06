import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { jidLabel } from '../whatsapp/jid.js';
import { timeAgo } from '../utils/time.js';
import { printTable, printInfo } from '../utils/output.js';

export function registerGroupsCommand(program: Command): void {
  program.command('groups').description('List stored group chats').action(() => groups());
}

import { withSocket } from './with-socket.js';

function groups(): Promise<void> {
  return withSocket(({ store }) => {
    const rows = store.listGroups();

    if (rows.length === 0) {
      printInfo('No groups stored yet — run "wacli watch" to sync.');
      return;
    }
    
    const tableData = rows.map(row => {
      const name = (row.name ?? jidLabel(row.jid)).slice(0, 30);
      const last = row.last_message_at ? timeAgo(new Date(row.last_message_at)) : '—';
      return [name, last];
    });
    
    printTable(['NAME', 'LAST MESSAGE'], tableData);
  }, { syncHistory: true });
}
