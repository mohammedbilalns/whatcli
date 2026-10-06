import type { WAMessage } from '@whiskeysockets/baileys';
import type { Message, MessageType } from '../models/message.js';

export type ParseResult =
| { ok: true; message: Message }
| { ok: false; reason: 'protocol-only' | 'empty' };


const MEDIA_TYPES: ReadonlySet<string> = new Set(['image', 'video', 'audio', 'voice', 'document', 'sticker']);

type Content = NonNullable<WAMessage['message']>;

// include extra runtime fields 
type RawKey = NonNullable<WAMessage['key']> & {
  remoteJidAlt?: string;
  participantAlt?: string;
  isViewOnce?: boolean;
};

export function parseMessage(raw: WAMessage): ParseResult {
  const key = (raw.key ?? {}) as RawKey;
  const content = unwrapContent(raw.message);

  if (!content) return { ok: false, reason: 'empty' }; 
  if (isProtocolOnly(content)) return { ok: false, reason: 'protocol-only' };

  const id = key.id ?? '';
  if (!id) return { ok: false, reason: 'empty' };

  const classified = classify(content) ?? { type: 'unknown' as const };

  return {
    ok: true,
    message: {
      id,
      chatId: key.remoteJid ?? '',
      senderId: key.participant || raw.participant || key.remoteJid || '',
      fromMe: !!key.fromMe,
      timestamp: toDate(raw.messageTimestamp),
      type: classified.type,
      text: classified.text,
      replyToId: classified.replyToId,
      pushName: raw.pushName || undefined,
      chatAltId: key.remoteJidAlt || undefined,
      senderAltId: (key.participantAlt as string | undefined) || key.remoteJidAlt || undefined,
      mediaJson: MEDIA_TYPES.has(classified.type) ? JSON.stringify(content) : undefined,
    },
  };
}

/** Disappearing and view-once messages wrap the real content one level down.
 *  loop until nothing more unwraps. */

function unwrapContent(m: Content | null | undefined): Content | undefined {
  let current = m ?? undefined; 
  while (current) {
    const record = current as Record<string, { message?: Content } | undefined>;
    const next =
      record.ephemeralMessage?.message ??
        record.viewOnceMessage?.message ??
        record.viewOnceMessageV2?.message;
    if (!next) break;
    current = next;
  }
  return current;
}

function isProtocolOnly(m: Content): boolean {
  const keys = Object.keys(m);
  return (
    keys.length > 0 &&
      keys.every((k) => k === 'senderKeyDistributionMessage' || k === 'messageContextInfo')
  );
}

// Classification result type 
interface Classified {
  type: MessageType;
  text?: string;
  replyToId?: string;
}

function classify(m: Content): Classified | null {
  // simple text message 
  if (m.conversation) return { type: 'text', text: m.conversation };

  // Extended text message sucha as replies , mentions and links
  if (m.extendedTextMessage) {
    const et = m.extendedTextMessage;
    return {
      type: 'text',
      text: et.text || undefined,
      replyToId: et.contextInfo?.stanzaId || undefined, // the replied-to message ID
    };
  }

  if (m.imageMessage) return media('image', m.imageMessage);
  if (m.videoMessage) return media('video', m.videoMessage);
  if (m.audioMessage) return { type: m.audioMessage.ptt ? 'voice' : 'audio' };
  if (m.documentMessage) {
    const d = m.documentMessage;
    return { type: 'document', text: d.fileName || undefined, replyToId: replyOf(d.contextInfo) };
  }
  if (m.stickerMessage) {
    return { type: 'sticker', replyToId: replyOf(m.stickerMessage.contextInfo) };
  }
  if (m.reactionMessage) {
    const r = m.reactionMessage;
    return { type: 'reaction', text: r.text || undefined, replyToId: r.key?.id || undefined };
  }
  if (m.locationMessage) return { type: 'location' };
  if (m.contactMessage) {
    return { type: 'contact', text: m.contactMessage.displayName || undefined };
  }
  // protocolMessage carries recalls/edits/revokes
  if (m.protocolMessage) return { type: 'system' };

  return null; 
}

/**
 * Extract caption and reply id from context for audio/video messages 
 */
function media(
  type: 'image' | 'video',
  m: { caption?: string | null; contextInfo?: { stanzaId?: string | null } | null },
): Classified {
  return { type, text: m.caption || undefined, replyToId: replyOf(m.contextInfo) };
}

function replyOf(ci?: { stanzaId?: string | null } | null): string | undefined {
  return ci?.stanzaId || undefined;
}

/**
 * convert unix timestamp to js Date  
 * If the timestamp is not provided,return current time
 */
function toDate(t: WAMessage['messageTimestamp']): Date {
  return t ? new Date(Number(t) * 1000) : new Date(); 
}
