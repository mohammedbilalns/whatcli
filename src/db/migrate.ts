import type {Database} from "better-sqlite3";

export interface Migration {
  name: string;
  up: (db: Database) => void;
}


export const migrations: Migration[] = [
  {
    name: "001_chats_message_contacts",
    up: (db) => {
      db.exec(
        `
CREATE TABLE chats (
jid             TEXT PRIMARY KEY,  
name            TEXT,             
type            TEXT NOT NULL CHECK (type IN ('direct', 'group')),
last_message_at TEXT,              
created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE messages (
id          TEXT PRIMARY KEY,      
chat_id     TEXT NOT NULL,
sender_id   TEXT NOT NULL,
from_me     INTEGER NOT NULL CHECK (from_me IN (0, 1)),
type        TEXT NOT NULL,
text        TEXT,
reply_to_id TEXT,                 
timestamp   TEXT NOT NULL,         
push_name   TEXT
);

CREATE INDEX idx_messages_chat_time ON messages (chat_id, timestamp);

CREATE TABLE contacts (
jid        TEXT PRIMARY KEY,
name       TEXT,                   
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`
      )
    }
  },
{
  name: '002_chats_alt_jid',
  up: (db) => {
    db.exec(`ALTER TABLE chats ADD COLUMN alt_jid TEXT;
             CREATE INDEX idx_chats_alt ON chats (alt_jid);`);
  },
},
{
  name: '003_messages_media_json',
  up: (db) => {
    db.exec('ALTER TABLE messages ADD COLUMN media_json TEXT;');
    },
  },
  {
    name: '004_contacts_identity',
    up: (db) => {
      db.exec(`
ALTER TABLE contacts ADD COLUMN phone TEXT;
ALTER TABLE contacts ADD COLUMN push_name TEXT;
ALTER TABLE contacts ADD COLUMN alias TEXT;

CREATE TABLE contact_links (
lid   TEXT NOT NULL,
phone TEXT NOT NULL,   -- full phone JID
PRIMARY KEY (lid, phone)
);

-- backfill pairs from the bridges Phase 9 built
INSERT OR IGNORE INTO contact_links (lid, phone)
SELECT jid, alt_jid FROM chats
WHERE jid LIKE '%@lid' AND alt_jid IS NOT NULL;

-- phone JID contacts get a normalized phone column
UPDATE contacts SET phone = jid WHERE jid LIKE '%@s.whatsapp.net%' AND phone IS NULL;
`);
    },
  },
{
  name: '005_rules',
  up: (db) => {
    db.exec(`
      CREATE TABLE rules (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger     TEXT NOT NULL,
        action      TEXT NOT NULL DEFAULT 'reply',
        value       TEXT NOT NULL,
        chat        TEXT NOT NULL DEFAULT '*',
        enabled     INTEGER NOT NULL DEFAULT 1,
        hit_count   INTEGER NOT NULL DEFAULT 0,
        last_fired  TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
},
{
  name: '006_auth_state',
  up: (db) => {
    db.exec(`
      CREATE TABLE auth_state (
        name TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);
  },
},
{
  name: '007_rules_action',
  up: (db) => {
    // For users who already ran 005_rules when it had a syntax error that hid the 'action' column inside a comment
    const info = db.pragma('table_info(rules)') as any[];
    if (!info.find((c) => c.name === 'action')) {
      db.exec(`ALTER TABLE rules ADD COLUMN action TEXT NOT NULL DEFAULT 'reply'`);
    }
  },
},
]


export function migrate(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(migration.name);
    })();
  }
}
