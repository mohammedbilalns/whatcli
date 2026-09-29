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
  }
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
