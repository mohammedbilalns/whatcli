import type { Message } from "../models/message.js";
import type { Rule } from "../models/rules.js";
import { isGroupChat } from "../whatsapp/jid.js";

export interface RuleHit {
	rule: Rule;
	matchText: string;
}

const CACHE = new Map<string, RegExp>();

export class RuleEngine {
	constructor(
		private readonly rules: Rule[],
		private readonly isContactSaved?: (jid: string) => boolean,
	) {}

	match(msg: Message): RuleHit | null {
		if (msg.fromMe) return null; // never react to ourselves (feedback loops!)
		if (msg.type !== "text" || !msg.text) return null; // rules fire on text only, for now

		for (const rule of this.rules) {
			if (!this.#inScope(rule, msg.chatId)) continue;

			const matched =
				rule.triggerType === "keyword"
					? msg.text.toLowerCase().includes(rule.triggerValue.toLowerCase())
					: this.#regex(rule).test(msg.text);

			if (matched) {
				return { rule, matchText: msg.text.slice(0, 80) };
			}
		}
		return null;
	}

	#inScope(rule: Rule, chatId: string): boolean {
		const isGroup = !!isGroupChat(chatId);
		if (rule.chat === "*") return !isGroup; // wildcard NEVER fires in groups
		if (rule.chat === "all") return true;
		if (rule.chat === "group") return isGroup;
		if (rule.chat === "direct") return !isGroup;
		if (rule.chat === "unknown")
			return !isGroup && !this.isContactSaved?.(chatId);
		return rule.chat === chatId; // explicit JID — group or direct
	}

	#regex(rule: Rule): RegExp {
		let re = CACHE.get(rule.triggerValue);
		if (!re) {
			re = new RegExp(rule.triggerValue, "i");
			CACHE.set(rule.triggerValue, re);
		}
		return re;
	}
}
