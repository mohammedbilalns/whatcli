export interface GroupParticipant {
  jid: string;
  name?: string; 
  role: 'superadmin' | 'admin' | 'member';
}

export interface GroupInfo {
  jid: string;
  name: string;
  description?: string;
  createdAt?: number; 
  announceOnly: boolean;
  adminEditOnly: boolean; 
  participants: GroupParticipant[];
}
