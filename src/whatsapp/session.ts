import { useMultiFileAuthState, type AuthenticationState } from '@whiskeysockets/baileys';
import type { Config } from '../utils/config.js';

export interface Session {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  hasSession: boolean;
}

export async function loadSession(config: Config): Promise<Session> {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  return { state, saveCreds, hasSession: state.creds.registered || !!state.creds.me?.id };
}
