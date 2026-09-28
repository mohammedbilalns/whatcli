import type { WASocket } from '@whiskeysockets/baileys';
import type { Message } from '../models/message.js';
import { parseMessage } from './parser.js';

export type MessageHandler = (message: Message) => void;

/**
 * Register a live-message listener on a socket.
 */
export function registerMessageListener(sock: WASocket, onMessage: MessageHandler): void {
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return; 

    for (const raw of messages) {
      if (process.env.WACLI_RAW) console.log(JSON.stringify(raw, null, 2));

      // Non-chat traffic: status posts, newsletters
      const jid = raw.key?.remoteJid ?? '';
      if (jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;

      const result = parseMessage(raw);
      if (result.ok) onMessage(result.message);
      // else: protocol sync / empty placeholder 
    }
  });
}
