import makeWASocket, {
  AuthenticationState,
  Browsers,
  makeCacheableSignalKeyStore,
  isJidStatusBroadcast,
  isJidNewsletter,
  CacheStore
} from "@whiskeysockets/baileys";
import { baileysLogger } from "../utils/logger.js";
import NodeCache from '@cacheable/node-cache';

// Persist these caches outside the create function so they survive socket reconnects.
const msgRetryCounterCache = new NodeCache() as CacheStore;
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

/**
 * Creates a Baileys WhatsApp Web socket.
 *
 * The socket manages the connection with WhatsApp,
 * authentication state, encryption, and incoming/outgoing messages.
 */
export function createWASocket( auth : AuthenticationState) {
  const sock = makeWASocket({
    logger: baileysLogger,
    
    auth: {
      creds: auth.creds,
      keys: makeCacheableSignalKeyStore(auth.keys, baileysLogger),
    },
    
    shouldIgnoreJid: (jid) => isJidStatusBroadcast(jid) || isJidNewsletter(jid),

    msgRetryCounterCache,
    
    cachedGroupMetadata: async (jid) => groupCache.get(jid),

    markOnlineOnConnect: false ,

    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 20_000,
    keepAliveIntervalMs: 30_000,
  });

  // Keep the cache warm when group state changes

  sock.ev.on('groups.update', async ([event]) => {
    if (event.id) {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    }
  });

  sock.ev.on('group-participants.update', async (event) => {
    if (event.id) {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    }
  });

  return sock;
}
