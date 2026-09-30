import { isJidGroup, jidDecode} from "@whiskeysockets/baileys";


export const isGroupChat = isJidGroup; 

export function isLid(jid: string): boolean {
  return jidDecode(jid)?.server === 'lid';
}


export function phoneFromJid(jid: string): string {
  const decoded = jidDecode(jid);
  const user = decoded?.user ?? '';
  if (!user) return jid;
  if (isLid(jid)) return `lid …${user.slice(-4)}`;
  return `+${user}`;
}

export const groupTail = (jid: string): string =>
  (jidDecode(jid)?.user ?? '').slice(-4);

export function jidLabel(jid: string): string {
  return isGroupChat(jid) ? `group …${groupTail(jid)}` : phoneFromJid(jid);
}
