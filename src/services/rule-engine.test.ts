import { describe, expect, it } from "vitest";
import type { Message } from "../models/message.js";
import type { Rule } from "../models/rules.js";
import { RuleEngine } from "./rule-engine.js";

const rule = (over: Partial<Rule> = {}): Rule => ({
	id: 1,
	triggerType: "keyword",
	triggerValue: "ping",
	action: "reply",
	value: "pong",
	chat: "*",
	enabled: true,
	hitCount: 0,
	lastFired: null,
	...over,
});

const msg = (over: Partial<Message> = {}) =>
	({
		id: "X",
		chatId: "919000000001@s.whatsapp.net",
		senderId: "919000000001@s.whatsapp.net",
		fromMe: false,
		timestamp: new Date(),
		type: "text",
		text: "ping",
		...over,
	}) as Message;

describe("RuleEngine", () => {
	it("matches keywords case-insensitively", () => {
		expect(
			new RuleEngine([rule()]).match(msg({ text: "anyone PING?" })),
		).not.toBeNull();
	});

	it("never matches own messages", () => {
		expect(new RuleEngine([rule()]).match(msg({ fromMe: true }))).toBeNull();
	});

	it("wildcard scope never fires in groups", () => {
		expect(
			new RuleEngine([rule()]).match(msg({ chatId: "123@g.us" })),
		).toBeNull();
	});

	it("explicit group JID scope fires in that group", () => {
		expect(
			new RuleEngine([rule({ chat: "123@g.us" })]).match(
				msg({ chatId: "123@g.us" }),
			),
		).not.toBeNull();
	});

	it("skips non-text messages", () => {
		expect(new RuleEngine([rule()]).match(msg({ type: "image" }))).toBeNull();
	});

	it("dynamically queries rules when a getter function is provided", () => {
		let currentRules = [rule({ triggerValue: "hello" })];
		const engine = new RuleEngine(() => currentRules);

		expect(engine.match(msg({ text: "hello" }))).not.toBeNull();
		expect(engine.match(msg({ text: "bye" }))).toBeNull();

		// Dynamically add a new rule without re-creating engine
		currentRules = [
			rule({ triggerValue: "hello" }),
			rule({ id: 2, triggerValue: "bye" }),
		];
		expect(engine.match(msg({ text: "bye" }))).not.toBeNull();
	});
});
