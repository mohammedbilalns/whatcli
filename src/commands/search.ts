import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { formatMessage } from '../utils/format.js';
import { jidLabel } from '../whatsapp/jid.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search <text>')
    .description('Search stored message text')
    .action(handleSearch);
}

function handleSearch(text: string): void {
  const db = openDatabase(loadConfig());
  const rows = db
    .prepare(`SELECT id, chat_id, sender_id, from_me, type, text, reply_to_id, timestamp, push_name
                  FROM messages
                  WHERE text LIKE ?
                  ORDER BY timestamp DESC
                  LIMIT 100`)
    .all(`%${text}%`) as import('../services/message-store.js').MessageRow[];

  if (rows.length === 0) {
    console.log(`No stored messages matching "${text}".`);
    db.close();
    return;
  }

  const chatNames = new Map(
    (db.prepare('SELECT jid, name FROM chats').all() as { jid: string; name: string | null }[])
      .map((r) => [r.jid, r.name]),
  );

  for (const row of rows) {
    const chatLabel = chatNames.get(row.chat_id) ?? jidLabel(row.chat_id);
    const msg = {
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      fromMe: row.from_me === 1,
      timestamp: new Date(row.timestamp),
      type: row.type as import('../models/message.js').MessageType,
      text: row.text ?? undefined,
      replyToId: row.reply_to_id ?? undefined,
      pushName: row.push_name ?? undefined,
    };
    console.log(`${chatLabel} │ ${formatMessage(msg)}`);
  }
  db.close();
}
