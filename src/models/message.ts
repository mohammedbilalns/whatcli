
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
  chatAltId?: string;
  senderAltId?: string;
}

