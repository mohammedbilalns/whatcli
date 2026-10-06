import type { WAMessage } from "@whiskeysockets/baileys";
import type { GroupInfo } from "../models/groups.js";
import type { Message } from "../models/message.js";
import type { ReplyTarget } from "./client.js";

export type { ReplyTarget };

export interface Sender {
	sendText(jid: string, text: string): Promise<Message>;
	sendReply(jid: string, target: ReplyTarget, text: string): Promise<Message>;
	sendReaction(
		jid: string,
		target: ReplyTarget,
		emoji: string,
	): Promise<Message>;
	sendImage(jid: string, filePath: string, caption?: string): Promise<Message>;
	sendDocument(jid: string, filePath: string): Promise<Message>;
	downloadMedia(
		raw: WAMessage,
	): Promise<{ buffer: Buffer; mediaJson?: string }>;
	groupInfo(jid: string): Promise<GroupInfo>;
	lookupPhone(
		phone: string,
	): Promise<{ jid: string; exists: boolean; lid?: string }[]>;
}
