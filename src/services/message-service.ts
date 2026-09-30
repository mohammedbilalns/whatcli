import type { Message } from '../models/message.js';
import type { MessageStore } from './message-store.js';
import type { WhatsAppClient } from '../whatsapp/client.js';

export class MessageService {
  constructor(
    private readonly client: WhatsAppClient,
    private readonly store: MessageStore,
  ) {}

  /** Send a text, persist it, return it (with its real message ID). */
  async sendText(chatJid: string, text: string): Promise<Message> {
    const sent = await this.client.sendText(chatJid, text);

    // Why store it ourselves: a socket does NOT receive its own sends back
    // via messages.upsert. (Messages sent from your PHONE do arrive — as the
    // fromMe "You >" lines you've seen in watch.) Storing here closes the gap;
    // INSERT OR IGNORE makes it safe even if a watcher also captured it.
    this.store.saveMessage(sent);
    return sent;
  }
}
