import type { WASocket } from '@whiskeysockets/baileys';
import { loadConfig } from '../utils/config.js';
import type { Config } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { MessageService } from '../services/message-service.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { loadSession } from '../whatsapp/session.js';
import { connectAndWait } from '../whatsapp/connect.js';
import { resolveChat, type Resolution } from '../whatsapp/jid.js';
import { Database } from 'better-sqlite3';
import { IpcClient } from '../ipc/client.js';
import { IpcSender } from '../ipc/ipc-sender.js';

/** Thrown for user-facing errors (bad name, missing message) — printed, exit 1. */
export class UserError extends Error {}

/** Resolve a name to a chat or throw a friendly UserError. */
export function resolveOrThrow(db: Database, name: string): Extract<Resolution, { ok: true }> {
  const r = resolveChat(db, name);
  if (r.ok) return r;
  if (r.error === 'not-found') throw new UserError(`No chat matching "${name}" found. Run "wacli chats".`);
  const lines = r.candidates.map((c) => `  ${c.label}   (${c.jid})`).join('\n');
  throw new UserError(`"${name}" matches several chats — be more specific:\n${lines}`);
}

/** Connect, run fn with a ready service, always tear down cleanly. */
export async function withSocket(
  fn: (ctx: { sock?: WASocket; service: MessageService; store: MessageStore; db: Database; config: Config }) => Promise<void>,
): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config);
  const ipc = new IpcClient(config.ipcPath)

  if (await ipc.alive()) {
    try {
      const store = new MessageStore(db);
      const service = new MessageService(new IpcSender(ipc), store);
      await fn({ service, store, db, config });
      db.close();
      return;
    } catch (err) {
      if (!(err instanceof UserError)) throw err; // UserError prints below as usual
      console.log(err.message);
      process.exit(1);
    }
  }

  const session = await loadSession(config);
  if (!session.hasSession) {
    console.log('Not logged in — run "wacli login" first.');
    db.close();
    process.exit(1);
  }

  const { sock, outcome } = await connectAndWait(session.state, session.saveCreds, { timeoutMs: 30_000 });
  if (outcome.status !== 'connected') {
    const why = outcome.status === 'timeout' ? 'timed out' : `code ${outcome.code}`;
    console.log(`Could not reach WhatsApp (${why}).`);
    db.close();
    process.exit(1);
  }

  try {
    try {
      const store = new MessageStore(db);
      const service = new MessageService(new WhatsAppClient(sock), store);
      await fn({ sock, service, store, db, config });
    } finally {
      await sock.end(undefined);
      await session.saveCreds();
      db.close();
    }
  } catch (err) {
    if (err instanceof UserError) {
      console.log(err.message);
      process.exit(1);
    }
    console.log(`❌ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}
