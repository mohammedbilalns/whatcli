import { isJidGroup, jidDecode} from "@whiskeysockets/baileys";

export function phoneFromJid(jid: string): string {
  const user = jidDecode(jid)?.user;
  return user ? `+${user}` : jid
}

/** Human label for any chat. */
export function jidLabel(jid: string): string {
  if (isJidGroup(jid)) return `group …${(jidDecode(jid)?.user ?? '').slice(-4)}`;
  return phoneFromJid(jid);
}

