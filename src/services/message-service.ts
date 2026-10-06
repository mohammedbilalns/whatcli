import type { Message } from "../models/message.js";
import type { MessageStore } from "./message-store.js";
import type { ReplyTarget } from "../whatsapp/client.js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { reconstructMediaMessage, describeMedia } from "../whatsapp/media.js";
import { mediaSubdir, ensureDir, extFromMime } from "../utils/files.js";
import { Sender } from "../whatsapp/sender.js";

export class MessageService {
	constructor(
		private readonly client: Sender,
		private readonly store: MessageStore,
	) {}

	async sendText(chatJid: string, text: string): Promise<Message> {
		const sent = await this.client.sendText(chatJid, text);

		this.store.saveMessage(sent);
		return sent;
	}

	async sendReply(
		chatJid: string,
		target: ReplyTarget,
		text: string,
	): Promise<Message> {
		const sent = await this.client.sendReply(chatJid, target, text);
		this.store.saveMessage(sent);
		return sent;
	}

	async sendReaction(
		chatJid: string,
		target: ReplyTarget,
		emoji: string,
	): Promise<Message> {
		const sent = await this.client.sendReaction(chatJid, target, emoji);
		this.store.saveMessage(sent);
		return sent;
	}

	async sendImage(
		chatJid: string,
		filePath: string,
		caption?: string,
	): Promise<Message> {
		const sent = await this.client.sendImage(chatJid, filePath, caption);
		this.store.saveMessage(sent);
		return sent;
	}

	async sendDocument(chatJid: string, filePath: string): Promise<Message> {
		const sent = await this.client.sendDocument(chatJid, filePath);
		this.store.saveMessage(sent);
		return sent;
	}

	async downloadAndSave(messageId: string, mediaDir: string): Promise<string> {
		const row = this.store.getMediaById(messageId);
		if (!row) throw new Error(`No stored message with id ${messageId}`);

		const mediaJson = row.media_json;
		if (!mediaJson)
			throw new Error(
				"No media data stored for this message (it predates media support or has no media)",
			);

		const raw = reconstructMediaMessage({ ...row, media_json: mediaJson });
		const desc = describeMedia(raw);
		if (!desc) throw new Error("Stored message contains no downloadable media");

		// ↓ renamed: this is the REFRESHED json from the retry path, not the stored one
		const { buffer, mediaJson: refreshedJson } =
			await this.client.downloadMedia(raw);
		if (refreshedJson) this.store.updateMediaJson(messageId, refreshedJson); // cache the refreshed URL

		const dir = ensureDir(path.join(mediaDir, mediaSubdir(desc.kind)));
		const name = desc.fileName
			? desc.fileName.replace(/[/\\]/g, "_")
			: `${desc.kind}-${messageId.slice(0, 8)}.${extFromMime(desc.mimetype)}`;
		const target = path.join(dir, name);
		writeFileSync(target, buffer);
		return target;
	}

	async groupInfo(jid: string) {
		return this.client.groupInfo(jid);
	}

	async lookupPhone(phone: string) {
		return this.client.lookupPhone(phone);
	}

	async downloadMediaVia(raw: any) {
		return this.client.downloadMedia(raw);
	}
}
