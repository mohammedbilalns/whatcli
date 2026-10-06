import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { resolveChat } from '../whatsapp/jid.js';
import { formatMessage } from '../utils/format.js';
import { ContactStore } from '../services/contact-store.js';
import { printInfo, printData, printError } from '../utils/output.js';

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
      printError(`No chat matching "${name}" found.`);
      printError('Run "wacli chats" to list stored chats.');
    } else {
      printError(`"${name}" matches several chats — be more specific:`);
      for (const c of resolved.candidates) printError(`  ${c.label}   (${c.jid})`);
    }
    db.close();
    process.exit(1);
  }

  const store = new MessageStore(db);
  const contacts = new ContactStore(db);
  const messages = store.listMessages(resolved.jid, limit);
  db.close();

  printInfo(resolved.label);
  const resolveName = (jid: string) => contacts.displayName(jid)
  printInfo('─'.repeat(50));
  if (messages.length === 0) {
    printInfo('No stored messages for this chat.');
    printInfo('(Only messages seen while watching, plus history sync, are stored.)');
    return;
  }

  for (const m of messages) {
    printData(opts.ids ? `${m.id}\t${formatMessage(m, resolveName)}` : formatMessage(m, resolveName));
  }
}
