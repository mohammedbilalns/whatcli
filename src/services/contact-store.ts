import type { Database } from 'better-sqlite3';
import { jidLabel } from '../whatsapp/jid.js';

export interface ContactRow {
  jid: string; phone: string | null; name: string | null; push_name: string | null; alias: string | null;
}

export class ContactStore {
  constructor(private readonly db: Database) {}

  upsertName(jid: string, name: string): void {
    this.db.prepare(`
INSERT INTO contacts (jid, name, push_name) VALUES (?, ?, ?)
ON CONFLICT(jid) DO UPDATE SET
name = COALESCE(excluded.name, contacts.name),
push_name = COALESCE(excluded.push_name, contacts.push_name)
`).run(jid, name, name);
  }

  setAlias(jid: string, alias: string | null): void {
    this.db.prepare('UPDATE contacts SET alias = ? WHERE jid = ?').run(alias, jid);
  }


  displayName(jid: string): string | null {
    const direct = this.db
      .prepare('SELECT alias, name FROM contacts WHERE jid = ?')
      .get(jid) as { alias: string | null; name: string | null } | undefined;
    if (direct?.alias ?? direct?.name) return direct.alias ?? direct.name!;

    // crossed the LID/phone divide? follow the link
    const linked = this.db
      .prepare(`SELECT c.alias, c.name FROM contact_links l
JOIN contacts c ON c.jid = (CASE WHEN l.lid = ? THEN l.phone ELSE l.lid END)
WHERE ? IN (l.lid, l.phone) AND (c.alias IS NOT NULL OR c.name IS NOT NULL)
LIMIT 1`)
      .get(jid, jid) as { alias: string | null; name: string | null } | undefined;
    return linked?.alias ?? linked?.name ?? null;
  }

  byJid(jid: string): ContactRow | undefined {
    return this.db.prepare('SELECT jid, phone, name, push_name, alias FROM contacts WHERE jid = ?')
      .get(jid) as ContactRow | undefined;
  }

  /** Find contacts by alias/name substring, phone digits, or JID tail. */
  findByText(q: string): ContactRow[] {
    const needle = `%${q.toLowerCase()}%`;
    const digits = q.replace(/\D/g, '');
    return this.db.prepare(`
SELECT jid, phone, name, push_name, alias FROM contacts
WHERE (alias IS NOT NULL AND LOWER(alias) LIKE ?)
OR (name IS NOT NULL AND LOWER(name) LIKE ?)
OR (? != '' AND phone LIKE '%' || ? || '%')
OR jid LIKE ?
ORDER BY alias IS NULL, name IS NULL LIMIT 20
`).all(needle, needle, digits, digits, `%${q}%`) as ContactRow[];
  }

  list(query?: string): ContactRow[] {
    if (query) return this.findByText(query);
    return this.db.prepare(`SELECT jid, phone, name, push_name, alias FROM contacts
WHERE alias IS NOT NULL OR name IS NOT NULL
ORDER BY alias IS NULL, name LIMIT 100`) as unknown as ContactRow[];
  }

  /** Best label for any JID (person or group) . */
  jidDisplayName(jid: string): string {
    return this.displayName(jid) ?? jidLabel(jid);
  }


  chatName(jid: string): string | null {
    const row = this.db.prepare(`
SELECT ct.alias AS a1, sct.alias AS a2, c.name AS own, ct.name AS contact,
s.name AS sibling, sct.name AS sibling_contact
FROM chats c
LEFT JOIN contacts ct  ON ct.jid  = c.jid
LEFT JOIN chats s      ON s.jid   = c.alt_jid
LEFT JOIN contacts sct ON sct.jid = c.alt_jid
WHERE c.jid = ?
`).get(jid) as Record<string, string | null> | undefined;
    if (!row) return null;
    return row.a1 ?? row.a2 ?? row.own ?? row.contact ?? row.sibling ?? row.sibling_contact ?? null;
  }


  syncLink(lid: string, phone: string): void {
    if (!lid.endsWith('@lid') || !phone.endsWith('@s.whatsapp.net')) return;

    this.db.prepare('INSERT OR IGNORE INTO contact_links (lid, phone) VALUES (?, ?)').run(lid, phone);

    // copy names in both directions, only where a side is nameless
    this.db.prepare(`UPDATE contacts SET name = (SELECT name FROM contacts WHERE jid = ? AND name IS NOT NULL)
WHERE jid = ? AND name IS NULL`).run(phone, lid);
    this.db.prepare(`UPDATE contacts SET name = (SELECT name FROM contacts WHERE jid = ? AND name IS NOT NULL)
WHERE jid = ? AND name IS NULL`).run(lid, phone);
  }



}
