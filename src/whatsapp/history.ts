import { type WASocket, isJidStatusBroadcast, isJidNewsletter } from '@whiskeysockets/baileys';
import type { Message } from '../models/message.js';
import { parseMessage } from './parser.js';

export interface HistoryChat { jid: string; name?: string }
export interface HistoryContact { jid: string; name?: string }

export interface HistoryBatch {
  chats: HistoryChat[];
  contacts: HistoryContact[];
  messages: Message[];
}

function skip(jid: string): boolean {
  return Boolean(!jid || isJidStatusBroadcast(jid) || isJidNewsletter(jid));
}

export function registerHistorySync(sock: WASocket, onHistory: (batch: HistoryBatch) => void): void {
  sock.ev.on('messaging-history.set', (sync) => {
    const messages: Message[] = [];
    for (const raw of sync.messages ?? []) {
      if (skip(raw.key?.remoteJid ?? '')) continue;
      const result = parseMessage(raw);
      if (result.ok) messages.push(result.message);
    }

    onHistory({
      chats: (sync.chats ?? [])
        .map((c) => ({ jid: String(c.id), name: c.name ?? undefined }))
        .filter((c) => !skip(c.jid)),
      contacts: (sync.contacts ?? [])
        .map((c) => ({ jid: String(c.id), name: c.name ?? undefined }))
        .filter((c) => !skip(c.jid)),
      messages,
    });
  });
}
