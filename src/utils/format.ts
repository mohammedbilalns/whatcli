import type { Message } from '../models/message.js';
import { groupTail, isGroupChat, phoneFromJid } from '../whatsapp/jid.js';

/** Render a Message for the terminal
 **/

export type NameResolver = (jid: string) => string | null;
export function formatMessage(m: Message, resolveName?: NameResolver): string {
  const time = m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sender = m.fromMe
    ? 'You'
    : resolveName?.(m.senderId) || m.pushName || phoneFromJid(m.senderId);   // ← resolver first
  const chat = isGroupChat(m.chatId) ? ` [group …${groupTail(m.chatId)}]` : '';
  return `[${time}] ${sender}${chat} > ${describe(m)}`;
}

function describe(m: Message): string {
  const reply = m.replyToId && m.type !== 'reaction' ? '   ⤷ (reply)' : '';
  switch (m.type) {
    case 'text':     return `${m.text ?? '(no text)'}${reply}`;
    case 'image':    return `[image${caption(m)}]${reply}`;
    case 'video':    return `[video${caption(m)}]${reply}`;
    case 'audio':    return `[audio file]${reply}`;
    case 'voice':    return `[voice note]${reply}`;
    case 'document': return `[document${caption(m)}]${reply}`;
    case 'sticker':  return `[sticker]${reply}`;
    case 'reaction': return `[reacted ${m.text ?? '?'}]`;
    case 'location': return '[location]';
    case 'contact':  return `[contact${caption(m)}]`;
    case 'system':   return '[system message]';
    case 'unknown':  return '[unsupported message]';
  }
}

function caption(m: Message): string {
  return m.text ? `: ${m.text}` : '';
}
