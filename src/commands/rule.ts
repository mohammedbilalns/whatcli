import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import type { ActionType, TriggerType } from "../models/rules.js";
import { RuleStore } from "../services/rule-store.js";
import { loadConfig } from "../utils/config.js";
import { resolveChat } from "../whatsapp/jid.js";

export function registerRuleCommand(program: Command): void {
	const rule = program.command("rule").description("Manage automation rules");

	rule
		.command("add <type> <trigger...>") // variadic: trigger may contain spaces
		.description("Add a rule. type: keyword|regex. Use -- for the prompt:")
		.option("-a, --action <action>", "reply or react", "reply")
		.option("-v, --value <value>", "reply text or emoji")
		.option(
			"-c, --chat <chat>",
			"scope: '*', 'all', 'direct', 'group', 'unknown', or a chat name/JID",
			"*",
		)
		.action(
			(
				type: string,
				triggerParts: string[],
				opts: { action: string; value?: string; chat: string },
			) => {
				const trigger = triggerParts.join(" ");
				if (!["keyword", "regex"].includes(type)) {
					console.log("type must be keyword or regex");
					process.exit(1);
				}
				if (!opts.value) {
					console.log("--value is required (the reply text or emoji)");
					process.exit(1);
				}
				if (!["reply", "react"].includes(opts.action)) {
					console.log("--action must be reply or react");
					process.exit(1);
				}

				const db = openDatabase(loadConfig());
				let chat = opts.chat;
				if (
					chat !== "*" &&
					chat !== "all" &&
					chat !== "direct" &&
					chat !== "group" &&
					chat !== "unknown"
				) {
					const r = resolveChat(db, chat);
					if (r.ok)
						chat = r.jid; // store the JID, not the name — names drift, JIDs don't
					else {
						console.log(`Unknown chat "${chat}" — scope stays unresolvable`);
						db.close();
						process.exit(1);
					}
				}
				try {
					const id = new RuleStore(db).add({
						triggerType: type as TriggerType,
						triggerValue: trigger,
						action: opts.action as ActionType,
						value: opts.value,
						chat,
					});
					console.log(
						`✅ Rule #${id} added (${type}:${trigger} → ${opts.action}) [scope: ${chat}]`,
					);
				} catch (err) {
					console.log(`❌ ${err instanceof Error ? err.message : err}`); // e.g. invalid regex
					process.exit(1);
				}
				db.close();
			},
		);

	rule
		.command("remove <id>")
		.description("Delete a rule")
		.action((id: string) => {
			const numId = parseInt(id, 10);
			const db = openDatabase(loadConfig());
			const ok = new RuleStore(db).remove(numId);
			if (ok) console.log(`✅ Rule #${numId} removed`);
			else console.log(`❌ Rule #${numId} not found`);
			db.close();
			process.exit(ok ? 0 : 1);
		});

	rule.command("on <id>").action((id: string) => {
		const numId = parseInt(id, 10);
		const db = openDatabase(loadConfig());
		new RuleStore(db).setEnabled(numId, true);
		console.log(`✅ Rule #${numId} enabled`);
		db.close();
		process.exit(0);
	});
	rule.command("off <id>").action((id: string) => {
		const numId = parseInt(id, 10);
		const db = openDatabase(loadConfig());
		new RuleStore(db).setEnabled(numId, false);
		console.log(`✅ Rule #${numId} disabled`);
		db.close();
		process.exit(0);
	});
}
