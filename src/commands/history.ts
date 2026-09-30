import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { resolveChat } from '../whatsapp/jid.js';
import { formatMessage } from '../utils/format.js';

export function registerHistoryCommand(program: Command): void {
  program
    .command('history <name>')
    .description('Show stored message history for a chat')
    .option('--ids', 'show message IDs (targets for reply/react)')
    .action((name: string, opts: { limit: string }) => history(name, opts));
}

async function history(name: string, opts: { limit: string ; ids?: boolean }): Promise<void> {
  const limit = Number(opts.limit) || 50;

  const config = loadConfig();
  const db = openDatabase(config);

  const resolved = resolveChat(db, name);
  if (!resolved.ok) {
    if (resolved.error === 'not-found') {
      console.log(`No chat matching "${name}" found.`);
      console.log('Run "wacli chats" to list stored chats.');
    } else {
      console.log(`"${name}" matches several chats — be more specific:`);
      for (const c of resolved.candidates) console.log(`  ${c.label}   (${c.jid})`);
    }
    db.close();
    process.exit(1);
  }

  const store = new MessageStore(db);
  const messages = store.listMessages(resolved.jid, limit);
  db.close();

  console.log(resolved.label);
  console.log('─'.repeat(50));
  if (messages.length === 0) {
    console.log('No stored messages for this chat.');
    console.log('(Only messages seen while watching, plus history sync, are stored.)');
    return;
  }
  for (const m of messages) console.log(opts.ids ? `${m.id}  ${formatMessage(m)}` : formatMessage(m));
}
