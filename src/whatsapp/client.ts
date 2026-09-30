import type { WASocket } from '@whiskeysockets/baileys';
import type { Message } from '../models/message.js';
import { parseMessage } from './parser.js';

/**
 * The ONLY place sock.sendMessage is called. Outbound adapter:
 * takes app-level arguments, returns our Message model.
 * Phase 8 adds reply/react; Phase 9 adds media.
 */
export class WhatsAppClient {
  constructor(private readonly sock: WASocket) {}

  async sendText(chatJid: string, text: string): Promise<Message> {
    const raw = await this.sock.sendMessage(chatJid, { text });
    if (!raw) {
      throw new Error('send not confirmed by server (no ack) — message may or may not have been delivered');
    }
    const parsed = parseMessage(raw); // the parser works in BOTH directions
    if (!parsed.ok) {
      // The message WAS sent — anything after this is our bookkeeping failing.
      throw new Error('send succeeded but the response could not be parsed');
    }
    return parsed.message;
  }
}
