import NodeCache from "@cacheable/node-cache";
import makeWASocket, {
	type AuthenticationState,
	Browsers,
	type CacheStore,
	fetchLatestBaileysVersion,
	type GroupMetadata,
	isJidNewsletter,
	isJidStatusBroadcast,
	makeCacheableSignalKeyStore,
	type proto,
} from "@whiskeysockets/baileys";
import { baileysLogger } from "../utils/logger.js";

// Persist these caches outside the create function so they survive socket reconnects.
const msgRetryCounterCache = new NodeCache() as CacheStore;

const groupCache = new NodeCache({
	stdTTL: 5 * 60,
	useClones: false,
}) as NodeCache<GroupMetadata>;

let cachedVersion: [number, number, number] | undefined;
export async function getLatestVersion(): Promise<
	[number, number, number] | undefined
> {
	if (cachedVersion) return cachedVersion;
	try {
		const { version } = await fetchLatestBaileysVersion();
		cachedVersion = version;
		return version;
	} catch {
		return undefined;
	}
}

/**
 * Creates a Baileys WhatsApp Web socket.
 *
 * The socket manages the connection with WhatsApp,
 * authentication state, encryption, and incoming/outgoing messages.
 */
export function createWASocket(
	auth: AuthenticationState,
	getMessage?: (key: proto.IMessageKey) => Promise<proto.IMessage | undefined>,
	version?: [number, number, number],
) {
	const sock = makeWASocket({
		logger: baileysLogger,
		version,

		auth: {
			creds: auth.creds,
			keys: makeCacheableSignalKeyStore(auth.keys, baileysLogger),
		},

		shouldIgnoreJid: (jid) => isJidStatusBroadcast(jid) || isJidNewsletter(jid),

		msgRetryCounterCache,
		maxMsgRetryCount: 5,

		cachedGroupMetadata: async (jid) => groupCache.get(jid),

		markOnlineOnConnect: false,

		browser: Browsers.ubuntu("WhatCLI"),
		syncFullHistory: true,
		connectTimeoutMs: 20_000,
		defaultQueryTimeoutMs: 60_000,
		keepAliveIntervalMs: 30_000,

		getMessage,
	});

	const debounceTimers = new Map<string, NodeJS.Timeout>();
	const refreshGroup = (jid: string | undefined) => {
		if (!jid) return;
		const existing = debounceTimers.get(jid);
		if (existing) clearTimeout(existing);

		debounceTimers.set(
			jid,
			setTimeout(async () => {
				debounceTimers.delete(jid);
				try {
					groupCache.set(jid, await sock.groupMetadata(jid));
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					if (msg.includes("item-not-found")) {
						baileysLogger.info(
							{ jid },
							"group no longer exists (deleted or you left) — skipping refresh",
						);
						groupCache.del(jid);
						return;
					}
					baileysLogger.warn({ err, jid }, "group metadata refresh failed");
				}
			}, 2000).unref(),
		);
	};

	sock.ev.on("groups.update", ([event]) => refreshGroup(event?.id));
	sock.ev.on("group-participants.update", (event) => refreshGroup(event?.id));

	return sock;
}
