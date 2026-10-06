import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import type { Message } from '../models/message.js';
import { parseMessage } from './parser.js';
import { isGroupChat } from './jid.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { inferMime } from '../utils/files.js';
import path from 'node:path';


import { baileysLogger } from '../utils/logger.js';

export interface ReplyTarget {
  id: string;
  fromMe: boolean;
  senderId: string;
  text?: string;
}
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



async sendReply(chatJid: string, target: ReplyTarget, text: string): Promise<Message> {
  // quoted = the message being replied to. Baileys needs its key; the
  // conversation text becomes the quoted-preview bubble others see.
  const quoted: WAMessage = {
    key: {
      remoteJid: chatJid,
      id: target.id,
      fromMe: target.fromMe,
      ...(isGroupChat(chatJid) ? { participant: target.senderId } : {}),
    },
    message: { conversation: target.text ?? '' },
  };
  const raw = await this.sock.sendMessage(chatJid, { text }, { quoted });
  if (!raw) throw new Error('reply not confirmed by server (no ack)');
  const parsed = parseMessage(raw);
  if (!parsed.ok) throw new Error('reply sent but response could not be parsed');
  return parsed.message;
}

async sendReaction(chatJid: string, target: ReplyTarget, emoji: string): Promise<Message> {
  const raw = await this.sock.sendMessage(chatJid, {
    react: { text: emoji, key: { remoteJid: chatJid, id: target.id, fromMe: target.fromMe } },
  });
  if (!raw) throw new Error('reaction not confirmed by server (no ack)');
  const parsed = parseMessage(raw);
  if (!parsed.ok) throw new Error('reaction sent but response could not be parsed');
  return parsed.message;
}


private confirm(raw: WAMessage | undefined): Message {
  if (!raw) throw new Error('send not confirmed by server (no ack)');
  const parsed = parseMessage(raw);
  if (!parsed.ok) throw new Error('send succeeded but the response could not be parsed');
  return parsed.message;
}

async sendImage(chatJid: string, filePath: string, caption?: string): Promise<Message> {
  return this.confirm(await this.sock.sendMessage(chatJid, {
    image: { url: filePath },   // Baileys reads the file, encrypts, uploads, then sends
    caption,
  }));
}



async sendDocument(chatJid: string, filePath: string): Promise<Message> {
  return this.confirm(await this.sock.sendMessage(chatJid, {
    document: { url: filePath },
    fileName: path.basename(filePath),
    mimetype: inferMime(filePath),   // WhatsApp needs this to render the file correctly
  }));

  }


async downloadMedia(raw: WAMessage): Promise<{ buffer: Buffer; mediaJson?: string }> {
  const buffer = await downloadMediaMessage(
    raw,
    'buffer',
    {},
    {
      logger: baileysLogger,
      reuploadRequest: (msg) => this.sock.updateMediaMessage(msg)
    }
  );
  return { buffer, mediaJson: JSON.stringify(raw.message) };
}
}


