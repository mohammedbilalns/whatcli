import type { WAMessage } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";
import { parseMessage } from "./parser.js";

// Real traffic captured from our own watch session (Phase 3).
const ownMessage = {
	key: {
		remoteJid: "121178274459659@lid",
		remoteJidAlt: "919207352145@s.whatsapp.net",
		fromMe: true,
		id: "AC1184CE8323B2D7E63873C32C7C39E8",
		participant: "",
		addressingMode: "lid",
	},
	messageTimestamp: 1790491938,
	pushName: "Me",
	message: { conversation: "hello" },
} as unknown as WAMessage;

const groupMessageWithSync = {
	key: {
		remoteJid: "919207352145-1598584354@g.us",
		fromMe: true,
		id: "AC65F8377F97E8659F5B88A3EC851862",
		participant: "249219789099121@lid",
		addressingMode: "lid",
	},
	messageTimestamp: 1790491958,
	pushName: "Me",
	message: {
		conversation: ".",
		senderKeyDistributionMessage: {
			groupId: "x",
			axolotlSenderKeyDistributionMessage: "x",
		},
		messageContextInfo: { messageSecret: "x" },
	},
} as unknown as WAMessage;

const protocolOnly = {
	key: {
		remoteJid: "919207352145-1598584354@g.us",
		fromMe: false,
		id: "ACEB309DEC136DF83265228E48485107",
		participant: "74251545665600@lid",
		addressingMode: "lid",
	},
	messageTimestamp: 1790491994,
	pushName: "Someone",
	message: {
		senderKeyDistributionMessage: {
			groupId: "x",
			axolotlSenderKeyDistributionMessage: "x",
		},
		messageContextInfo: { deviceListMetadata: {} },
	},
} as unknown as WAMessage;

const viewOncePlaceholder = {
	key: {
		remoteJid: "919207352145-1598584354@g.us",
		fromMe: false,
		id: "ACEB309DEC136DF83265228E48485107-1",
		participant: "74251545665600@lid",
		isViewOnce: true,
		addressingMode: "lid",
	},
	messageTimestamp: 1790491994,
	pushName: "Someone",
} as unknown as WAMessage;

describe("parseMessage", () => {
	it("parses a plain outgoing 1:1 text", () => {
		const r = parseMessage(ownMessage);
		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error("expected ok");
		expect(r.message.type).toBe("text");
		expect(r.message.text).toBe("hello");
		expect(r.message.fromMe).toBe(true);
		expect(r.message.chatId).toBe("121178274459659@lid");
		expect(r.message.timestamp).toBeInstanceOf(Date);
	});

	it("parses a group message that bundles sender-key sync with content", () => {
		const r = parseMessage(groupMessageWithSync);
		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error("expected ok");
		expect(r.message.type).toBe("text");
		expect(r.message.senderId).toBe("249219789099121@lid"); // participant, not the group JID
	});

	it("drops protocol-only messages", () => {
		expect(parseMessage(protocolOnly)).toEqual({
			ok: false,
			reason: "protocol-only",
		});
	});

	it("drops view-once placeholders with no body", () => {
		expect(parseMessage(viewOncePlaceholder)).toEqual({
			ok: false,
			reason: "empty",
		});
	});
});
