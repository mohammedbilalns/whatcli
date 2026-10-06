import type { Database } from "better-sqlite3";
import { Rule, RuleInput } from "../models/rules.js";

export class RuleStore {
	constructor(private readonly db: Database) {}

	add(input: RuleInput): number {
		if (input.triggerType === "regex") new RegExp(input.triggerValue); // throws on bad regex — do it here, before insert
		const info = this.db
			.prepare(
				"INSERT INTO rules (trigger, action, value, chat) VALUES (?, ?, ?, ?)",
			)
			.run(
				`${input.triggerType}:${input.triggerValue}`,
				input.action,
				input.value,
				input.chat,
			);
		return Number(info.lastInsertRowid);
	}

	remove(id: number): boolean {
		return (
			this.db.prepare("DELETE FROM rules WHERE id = ?").run(id).changes > 0
		);
	}

	setEnabled(id: number, enabled: boolean): void {
		this.db
			.prepare("UPDATE rules SET enabled = ? WHERE id = ?")
			.run(enabled ? 1 : 0, id);
	}

	activeRules(): Rule[] {
		return (
			this.db
				.prepare("SELECT * FROM rules WHERE enabled = 1")
				.all() as RuleRow[]
		).map((r) => this.#toRule(r));
	}

	allRules(): Rule[] {
		return (
			this.db.prepare("SELECT * FROM rules ORDER BY id").all() as RuleRow[]
		).map((r) => this.#toRule(r));
	}

	recordHit(id: number): void {
		this.db
			.prepare(
				"UPDATE rules SET hit_count = hit_count + 1, last_fired = datetime('now') WHERE id = ?",
			)
			.run(id);
	}

	#toRule(r: RuleRow): Rule {
		const [type, ...rest] = r.trigger.split(":");
		const value = rest.join(":"); // regex sources may contain colons
		return {
			id: r.id,
			triggerType: type === "regex" ? "regex" : "keyword",
			triggerValue: value,
			action: r.action === "react" ? "react" : "reply",
			value: r.value,
			chat: r.chat,
			enabled: r.enabled === 1,
			hitCount: r.hit_count,
			lastFired: r.last_fired
				? new Date(r.last_fired.replace(" ", "T") + "Z")
				: null,
		};
	}
}

interface RuleRow {
	id: number;
	trigger: string;
	action: string;
	value: string;
	chat: string;
	enabled: number;
	hit_count: number;
	last_fired: string | null;
}
