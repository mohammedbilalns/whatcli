
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'      
  | 'document'
  | 'sticker'
  | 'reaction'
  | 'location'
  | 'contact'
  | 'system'
  | 'unknown';


export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  fromMe: boolean;
  timestamp: Date;
  type: MessageType;
  text?: string;
  replyToId?: string;
  pushName?: string;
}

export function isGroupMessage(msg: Message): boolean {
  return msg.chatId.endsWith('@g.us');
}

export function isGroupChat(chatId: string): boolean {
  return chatId.endsWith('@g.us');
}
