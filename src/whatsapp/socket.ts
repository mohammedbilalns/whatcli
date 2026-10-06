import makeWASocket, {
  AuthenticationState,
  Browsers,
  makeCacheableSignalKeyStore,
  isJidStatusBroadcast,
  isJidNewsletter,
  CacheStore,
  GroupMetadata,
  proto
} from "@whiskeysockets/baileys";
import { baileysLogger } from "../utils/logger.js";
import NodeCache from '@cacheable/node-cache';

// Persist these caches outside the create function so they survive socket reconnects.
const msgRetryCounterCache = new NodeCache() as CacheStore;

const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false }) as NodeCache<GroupMetadata>;

/**
 * Creates a Baileys WhatsApp Web socket.
 *
 * The socket manages the connection with WhatsApp,
 * authentication state, encryption, and incoming/outgoing messages.
 */

export function createWASocket( auth : AuthenticationState, getMessage?: (key: proto.IMessageKey) => Promise<proto.IMessage | undefined>) {
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

    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    syncFullHistory: true,
    connectTimeoutMs: 20_000,
    keepAliveIntervalMs: 30_000,

    getMessage,
  });


  const refreshGroup = async (jid: string | undefined) => {
    if (!jid) return;
    try {
      groupCache.set(jid, await sock.groupMetadata(jid));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('item-not-found')) {
        baileysLogger.info({ jid }, 'group no longer exists (deleted or you left) — skipping refresh');
        groupCache.del(jid);
        return;
      }
      baileysLogger.warn({ err, jid }, 'group metadata refresh failed')
    }
  };

  sock.ev.on('groups.update', ([event]) => void refreshGroup(event?.id));
  sock.ev.on('group-participants.update', (event) => void refreshGroup(event?.id));

  return sock;
}
