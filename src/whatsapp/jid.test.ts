// src/whatsapp/jid.test.ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../db/migrate.js';
import { resolveChat } from './jid.js';

describe('resolveChat', () => {
  it('prefers the exact name over partial matches', () => {
    const db = new Database(':memory:');
    migrate(db);
    db.prepare(`INSERT INTO chats (jid, type, name) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`).run(
      '919100000001@s.whatsapp.net', 'direct', 'Dev',
      '919100000002@s.whatsapp.net', 'direct', 'Developers',
      '919100000003@s.whatsapp.net', 'direct', 'Developer Gang',
    );

    expect(resolveChat(db, 'dev')).toMatchObject({ ok: true, label: 'Dev' });       // exact wins
    expect(resolveChat(db, 'develop')).toMatchObject({ ok: false, error: 'ambiguous' }); // 2 partials
    expect(resolveChat(db, 'nobody')).toMatchObject({ ok: false, error: 'not-found' });
  });
});
