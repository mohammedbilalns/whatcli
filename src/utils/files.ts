import { mkdirSync } from 'node:fs';
import path from 'node:path';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.txt': 'text/plain',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
};

export function inferMime(filePath: string): string {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function extFromMime(mimetype: string): string {
  const sub = mimetype.split(';')[0]?.split('/')[1] ?? 'bin';
  return sub === 'jpeg' ? 'jpg' : sub;
}

export function mediaSubdir(kind: 'image' | 'video' | 'audio' | 'document' | 'sticker'): string {
  if (kind === 'video' || kind === 'audio') return kind + 's';       // videos/ audio/
  if (kind === 'document') return 'documents';
  return 'images'; 
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}
