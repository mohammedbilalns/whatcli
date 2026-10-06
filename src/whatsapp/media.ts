import type { WAMessage } from '@whiskeysockets/baileys';

export interface MediaDescriptor {
  kind: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  mimetype: string;
  fileName?: string;
}

export interface StoredMediaRow {
  id: string;
  chat_id: string;
  from_me: number;
  media_json: string;
}

export function reconstructMediaMessage(row: StoredMediaRow): WAMessage {
  return {
    key: { remoteJid: row.chat_id, id: row.id, fromMe: row.from_me === 1 },
    message: JSON.parse(row.media_json) as WAMessage['message'],
  };
}

export function describeMedia(raw: WAMessage): MediaDescriptor | undefined {
  const m = raw.message;
  if (!m) return undefined;
  if (m.imageMessage)    return { kind: 'image',    mimetype: m.imageMessage.mimetype ?? 'image/jpeg' };
  if (m.videoMessage)    return { kind: 'video',    mimetype: m.videoMessage.mimetype ?? 'video/mp4' };
  if (m.audioMessage)    return { kind: 'audio',    mimetype: m.audioMessage.mimetype ?? 'audio/ogg' };
  if (m.documentMessage) return { kind: 'document', mimetype: m.documentMessage.mimetype ?? 'application/octet-stream', fileName: m.documentMessage.fileName ?? undefined };
  if (m.stickerMessage)  return { kind: 'sticker',  mimetype: 'image/webp' };
  return undefined;
}
