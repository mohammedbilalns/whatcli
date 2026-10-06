import type { WASocket, GroupMetadata } from '@whiskeysockets/baileys';
import { GroupInfo } from '../models/groups.js';

/** Fetch live group metadata and map it to model. Names are filled by
 *  the caller . */
export async function fetchGroupInfo(sock: WASocket, jid: string): Promise<GroupInfo> {
  let md: GroupMetadata;
  try {
    md = await sock.groupMetadata(jid);
  } catch (err) {
    throw new Error(`Could not fetch group metadata: ${err instanceof Error ? err.message : err}`);
  }

  return {
    jid,
    name: md.subject || jid,
    description: md.desc || undefined,
    createdAt: md.creation ? Number(md.creation) : undefined, // Long guard
    announceOnly: !!md.announce,
    adminEditOnly: !!md.restrict,
    participants: (md.participants ?? []).map((p) => ({
      jid: p.id,
      // protobuf: absent enum field = null = plain member
      role: p.admin === 'superadmin' ? 'superadmin' : p.admin === 'admin' ? 'admin' : 'member',
    })),
  };
}
