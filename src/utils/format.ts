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

import pc from 'picocolors';

function describe(m: Message): string {
  const reply = m.replyToId && m.type !== 'reaction' ? pc.dim('   ⤷ (reply)') : '';
  switch (m.type) {
    case 'text':     return `${m.text ?? '(no text)'}${reply}`;
    case 'image':    return pc.magenta(`[image${caption(m)}]`) + reply;
    case 'video':    return pc.magenta(`[video${caption(m)}]`) + reply;
    case 'audio':    return pc.magenta(`[audio file]`) + reply;
    case 'voice':    return pc.magenta(`[voice note]`) + reply;
    case 'document': return pc.magenta(`[document${caption(m)}]`) + reply;
    case 'sticker':  return pc.magenta(`[sticker]`) + reply;
    case 'reaction': return pc.yellow(`[reacted ${m.text ?? '?'}]`);
    case 'location': return pc.magenta('[location]');
    case 'contact':  return pc.magenta(`[contact${caption(m)}]`);
    case 'system':   return pc.gray('[system message]');
    case 'unknown':  return pc.gray('[unsupported message]');
  }
}

function caption(m: Message): string {
  return m.text ? `: ${m.text}` : '';
}
