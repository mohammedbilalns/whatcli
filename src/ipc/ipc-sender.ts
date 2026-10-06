import { Sender, ReplyTarget } from "../whatsapp/sender.js";
import type { Message } from "../models/message.js";
import { GroupInfo } from "../models/groups.js";
import type { WAMessage } from "@whiskeysockets/baileys";
import type { IpcClient } from "./client.js";

export class IpcSender implements Sender {
	constructor(private readonly ipc: IpcClient) {}

	async sendText(jid: string, text: string): Promise<Message> {
		return this.#revive(
			(await this.ipc.request("send.text", { jid, text })) as Message,
		);
	}

	async sendReply(
		jid: string,
		target: ReplyTarget,
		text: string,
	): Promise<Message> {
		return this.#revive(
			(await this.ipc.request("send.reply", { jid, target, text })) as Message,
		);
	}

	async sendReaction(
		jid: string,
		target: ReplyTarget,
		emoji: string,
	): Promise<Message> {
		return this.#revive(
			(await this.ipc.request("send.reaction", {
				jid,
				target,
				emoji,
			})) as Message,
		);
	}

	async sendImage(
		jid: string,
		filePath: string,
		caption?: string,
	): Promise<Message> {
		return this.#revive(
			(await this.ipc.request("send.image", {
				jid,
				filePath,
				caption,
			})) as Message,
		);
	}

	async sendDocument(jid: string, filePath: string): Promise<Message> {
		return this.#revive(
			(await this.ipc.request("send.document", { jid, filePath })) as Message,
		);
	}

	async downloadMedia(
		raw: WAMessage,
	): Promise<{ buffer: Buffer; mediaJson?: string }> {
		// media_json is already a JSON string — the message object round-trips cleanly
		const res = (await this.ipc.request("media.download", {
			key: raw.key,
			message: raw.message,
		})) as { b64: string; mediaJson?: string };
		return { buffer: Buffer.from(res.b64, "base64"), mediaJson: res.mediaJson };
	}

	async groupInfo(jid: string): Promise<GroupInfo> {
		return (await this.ipc.request("group.info", { jid })) as GroupInfo;
	}

	async lookupPhone(phone: string) {
		return (await this.ipc.request("lookup", { phone })) as {
			jid: string;
			exists: boolean;
			lid?: string;
		}[];
	}

	#revive(m: Message): Message {
		return { ...m, timestamp: new Date(m.timestamp) }; // JSON turned the Date into a string
	}
}
