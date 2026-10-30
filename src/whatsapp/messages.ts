import {
	isJidNewsletter,
	isJidStatusBroadcast,
	type WASocket,
} from "@whiskeysockets/baileys";
import type { Message } from "../models/message.js";
import { parseMessage } from "./parser.js";

export interface MessageContext {
	/** true = live traffic; false = backfill that arrived while we were away */
	live: boolean;
}
export type MessageHandler = (
	message: Message,
	context: MessageContext,
) => void;

/**
 * Register a live-message listener on a socket.
 */
export function registerMessageListener(
	sock: WASocket,
	onMessage: MessageHandler,
): void {
	sock.ev.on("messages.upsert", ({ messages, type }) => {
		if (type !== "notify" && type !== "append") return;
		const live = type === "notify";

		for (const raw of messages) {
			if (process.env.WACLI_RAW) console.log(JSON.stringify(raw, null, 2));

			const jid = raw.key?.remoteJid ?? "";

			if (isJidStatusBroadcast(jid) || isJidNewsletter(jid)) continue;

			const result = parseMessage(raw);
			if (result.ok) onMessage(result.message, { live });
		}
	});
}
