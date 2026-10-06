/**
 * Persistence layer that saves whatsapp messagees, chats and contact to the sqlite db and provide read access for the cli  
 */

import { Database } from "better-sqlite3";
import { Message } from "../models/message.js";
import { HistoryBatch } from "../whatsapp/history.js";
import { isJidGroup } from "@whiskeysockets/baileys";
import { isGroupChat } from "../whatsapp/jid.js";

export interface ChatRow {
  id: number;
  jid: string;
  name: string | null;
  type: 'direct' | 'group';
  last_message_at: string | null;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  from_me: 0 | 1;
  type: string;
  text: string | null;
  reply_to_id: string | null;  
  timestamp: string;
  push_name: string | null 
}
export interface MediaRow {
  id: string; chat_id: string; from_me: number; type: string; media_json: string | null;
}

export class MessageStore {

  private readonly stmtChatFromMessage;
  private readonly stmtChatFromHistory;
  // Add message in the messages, ignore if already exists
  private readonly stmtInsertMessage;
  // Add/update contacts. Keep the newest name they used.
  private readonly stmtUpsertContact;
  // Run update , chat , messge, contact as a transaction 
  private readonly txSave;          
  // Run history message ingestion as a transaction 
  private readonly txIngest;       

  constructor(private readonly db : Database){


    /** 
     *Create chat record 
     Update it if the jid already exists 
     if name is not there update name 
     update the last_message_at with the newest time 
     * */
    this.stmtChatFromMessage = db.prepare(`
INSERT INTO chats (jid, type, name, last_message_at, alt_jid)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT (jid) DO UPDATE SET
name = COALESCE(chats.name, excluded.name),
last_message_at = COALESCE(MAX(chats.last_message_at, excluded.last_message_at), excluded.last_message_at),
alt_jid = COALESCE(chats.alt_jid, excluded.alt_jid)
`);

    /** 
     *Create new chat if the jid already exists update the name if if it not there  
     * */
    this.stmtChatFromHistory = db.prepare(`
INSERT INTO chats (jid, type, name)
VALUES (?, ?, ?)
ON CONFLICT(jid) DO UPDATE SET name = COALESCE(chats.name, excluded.name)
`);

    /** 
     *insert message if it is not already there else ignore  
     * */
this.stmtInsertMessage = db.prepare(`
  INSERT OR IGNORE INTO messages
  (id, chat_id, sender_id, from_me, type, text, reply_to_id, timestamp, push_name, media_json)
  VALUES (@id, @chat_id, @sender_id, @from_me, @type, @text, @reply_to_id, @timestamp, @push_name, @media_json)
`);

    /** 
     *Create contact if it doesnt exist. If it already exists
     update its name and record when it was updated 
     * */
    this.stmtUpsertContact = db.prepare(`
INSERT INTO contacts (jid, name) VALUES (?, ?)
ON CONFLICT(jid) DO UPDATE SET
name = COALESCE(excluded.name, contacts.name),
updated_at = datetime('now')
`);

    this.txSave = this.db.transaction((msg: Message) => {
      this.#chatFromMessage(msg);
      this.stmtInsertMessage.run(this.#row(msg));
      if (!msg.fromMe && msg.pushName) this.stmtUpsertContact.run(msg.senderId, msg.pushName);
    });

    this.txIngest = this.db.transaction((batch: HistoryBatch): number => {
      let stored = 0;
      for (const c of batch.chats) {
        this.stmtChatFromHistory.run(c.jid, isGroupChat(c.jid) ? 'group' : 'direct', c.name ?? null);
      }
      for (const c of batch.contacts) {
        if (isGroupChat(c.jid)) continue;
        if (c.name && /^\+[\d∙]+$/.test(c.name)) c.name = undefined;
        this.stmtUpsertContact.run(c.jid, c.name ?? null);
      }
      for (const msg of batch.messages) {
        this.#chatFromMessage(msg);
        const info = this.stmtInsertMessage.run(this.#row(msg));
        stored += info.changes;
        if (!msg.fromMe && msg.pushName) this.stmtUpsertContact.run(msg.senderId, msg.pushName);
      }
      return stored;
    });

  }


  /**
   * single transaction that handles -  Upserts chat, inserts messge, upserts contact 
   */
  saveMessage(msg: Message): void {
    this.txSave(msg) 
  }


  /**
   * Single transaction for entire history sync batch ( chats + contacts messages) 
   * @returns all chats ordered by last_message_at DESC 
   */
  ingestHistory(batch: HistoryBatch): number {
    return this.txIngest(batch)
  }


  /**
   * @returns all chats ordered by last_message_at DESC 
   */
  listChats(): ChatRow[] {
    return this.db
      .prepare(`SELECT rowid AS id, jid, name, type, last_message_at FROM chats
ORDER BY last_message_at DESC`) 
      .all() as ChatRow[];
  }

  /**
   * Figure out chat display name and run the transaction  
   * Chat messge is only found if 
   * - It is a message from someone else
   * - It is a 1-1 chat (not group)
   */
  #chatFromMessage(msg: Message): void {
    const name = !msg.fromMe && !isJidGroup(msg.chatId) ? msg.pushName ?? null : null;
    // Run the prepared statement to upsert chat row 
    this.stmtChatFromMessage.run(
      msg.chatId, isGroupChat(msg.chatId) ? 'group' : 'direct',
      name, msg.timestamp.toISOString(), msg.chatAltId ?? null,
    );
  }

  /**
   * Transform message object to db row 
   */
  #row(msg: Message) {
    return {
      id: msg.id,
      chat_id: msg.chatId,
      sender_id: msg.senderId,
      from_me: msg.fromMe ? 1 : 0,
      type: msg.type,
      text: msg.text ?? null,
      reply_to_id: msg.replyToId ?? null,
      timestamp: msg.timestamp.toISOString(),
      push_name: msg.pushName ?? null,
      media_json: msg.mediaJson ?? null,
    };
  }

  /** Load a chat's messages, oldest first, most recent N. */
  listMessages(chatJid: string, limit = 50): Message[] {
    const rows = this.db
      .prepare(`SELECT id, chat_id, sender_id, from_me, type, text, reply_to_id, timestamp, push_name
FROM messages
WHERE chat_id = ?
ORDER BY timestamp DESC
LIMIT ?`)
      .all(chatJid, limit) as MessageRow[];

    // newest-first from SQL → chronological for display
    return rows.reverse().map((row) => ({
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      fromMe: row.from_me === 1,
      timestamp: new Date(row.timestamp),
      type: row.type as Message['type'],
      text: row.text ?? undefined,
      replyToId: row.reply_to_id ?? undefined,
      pushName: row.push_name ?? undefined,
    }));

  }

  chatName(jid: string): string | null {
    const row = this.db.prepare(`
SELECT c.name AS own, ct.name AS contact, s.name AS sibling, sct.name AS sibling_contact
FROM chats c
LEFT JOIN contacts ct  ON ct.jid  = c.jid
LEFT JOIN chats s      ON s.jid   = c.alt_jid
LEFT JOIN contacts sct ON sct.jid = c.alt_jid
WHERE c.jid = ?
`).get(jid) as { own: string | null; contact: string | null; sibling: string | null; sibling_contact: string | null } | undefined;
    return row?.own ?? row?.contact ?? row?.sibling ?? row?.sibling_contact ?? null;
  }

upsertContact(jid: string, name: string): void {
  this.stmtUpsertContact.run(jid, name);
}

/** Look up a stored message by ID — the reply/react target. */
getMessageById(id: string): { id: string; chat_id: string; sender_id: string; from_me: number; text: string | null } | undefined {
  return this.db
    .prepare('SELECT id, chat_id, sender_id, from_me, text FROM messages WHERE id = ?')
    .get(id) as { id: string; chat_id: string; sender_id: string; from_me: number; text: string | null } | undefined;
}

getMediaById(id: string): MediaRow | undefined {
  return this.db
    .prepare('SELECT id, chat_id, from_me, type, media_json FROM messages WHERE id = ?')
    .get(id) as MediaRow | undefined;
}

updateMediaJson(id: string, mediaJson: string): void {
  this.db.prepare('UPDATE messages SET media_json = ? WHERE id = ?').run(mediaJson, id);
}

}
