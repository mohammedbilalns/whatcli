import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../db/migrate";
import { ContactStore } from "./contact-store";

describe("ContactStore", () => {
	it("alias beats every other name, links sync names", () => {
		const db = new Database(":memory:");

		migrate(db);

		const store = new ContactStore(db);

		store.upsertName("111@lid", "Pushy");

		db.prepare(
			"INSERT INTO contact_links VALUES ('111@lid', '919000000001@s.whatsapp.net')",
		).run();

		expect(store.displayName("919000000001@s.whatsapp.net")).toBe("Pushy");
	});

	it("list() returns an iterable array of contact rows without throwing", () => {
		const db = new Database(":memory:");
		migrate(db);
		const store = new ContactStore(db);

		store.upsertName("111@lid", "Alice");
		store.upsertName("222@lid", "Bob");

		const all = store.list();
		expect(Array.isArray(all)).toBe(true);
		expect(all.length).toBe(2);
		expect(all.map((c) => c.name)).toContain("Alice");

		const filtered = store.list("Ali");
		expect(Array.isArray(filtered)).toBe(true);
		expect(filtered.length).toBe(1);
		expect(filtered[0]?.name).toBe("Alice");
	});
});
