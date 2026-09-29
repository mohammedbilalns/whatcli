/**
 * Persistence layer that saves whatsapp messagees, chats and contact to the sqlite db and provide read access for the cli  
 */

import { Database } from "better-sqlite3";
import { Message } from "../models/message.js";
import { HistoryBatch } from "../whatsapp/history.js";
import { isJidGroup } from "@whiskeysockets/baileys";

export interface ChatRow {
  id: number;
  jid: string;
  name: string | null;
  type: 'direct' | 'group';
  last_message_at: string | null;
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
INSERT INTO chats (jid, type, name, last_message_at)
VALUES (?, ?, ?, ?)
ON CONFLICT (jid) DO UPDATE SET
name = COALESCE(chats.name, excluded.name),
last_message_at = COALESCE(MAX(chats.last_message_at, excluded.last_message_at), excluded.last_message_at)
`)

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
(id, chat_id, sender_id, from_me, type, text, reply_to_id, timestamp, push_name)
VALUES (@id, @chat_id, @sender_id, @from_me, @type, @text, @reply_to_id, @timestamp, @push_name)
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
        this.stmtChatFromHistory.run(c.jid, isJidGroup(c.jid) ? 'group' : 'direct', c.name ?? null);
      }
      for (const c of batch.contacts) {
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
      msg.chatId,
      isJidGroup(msg.chatId) ? 'group' : 'direct',
      name,
      msg.timestamp.toISOString(),
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
    };
  }
}
