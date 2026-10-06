import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../db/migrate.js";
import { MessageStore } from "./message-store.js";
import type { Message } from "../models/message.js";

const fixture: Message = {
	id: "TEST1",
	chatId: "919876543210@s.whatsapp.net",
	senderId: "919876543210@s.whatsapp.net",
	fromMe: false,
	timestamp: new Date(),
	type: "text",
	text: "hello",
	pushName: "Tester",
};

describe("MessageStore", () => {
	it("round-trips a message", () => {
		const db = new Database(":memory:");
		migrate(db);
		const store = new MessageStore(db);

		store.saveMessage(fixture);

		const count = (table: string) =>
			(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number })
				.n;
		console.log("row counts:", {
			chats: count("chats"),
			messages: count("messages"),
			contacts: count("contacts"),
		});

		const chats = store.listChats();
		expect(chats).toHaveLength(1);
		expect(chats[0]?.name).toBe("Tester");
	});
});
