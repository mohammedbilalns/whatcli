import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import type { ActionType, TriggerType } from "../models/rules.js";
import { RuleStore } from "../services/rule-store.js";
import { loadConfig } from "../utils/config.js";
import {
	printData,
	printError,
	printJson,
	printSuccess,
} from "../utils/output.js";
import { resolveChat } from "../whatsapp/jid.js";

interface RuleAddOptions {
	action: string;
	value?: string;
	chat: string;
	quiet?: boolean;
	json?: boolean;
}

interface RuleMutationOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerRuleCommand(program: Command): void {
	const rule = program.command("rule").description("Manage automation rules");

	rule
		.command("add <type> <trigger...>")
		.description("Add a rule. type: keyword|regex. Use -- for the prompt:")
		.option("-a, --action <action>", "reply or react", "reply")
		.option("-v, --value <value>", "reply text or emoji")
		.option(
			"-c, --chat <chat>",
			"scope: '*', 'all', 'direct', 'group', 'unknown', or a chat name/JID",
			"*",
		)
		.option("-q, --quiet", "suppress output and only print the created rule ID")
		.option("--json", "output result as JSON")
		.action((type: string, triggerParts: string[], opts: RuleAddOptions) => {
			const trigger = triggerParts.join(" ");
			if (!["keyword", "regex"].includes(type)) {
				printError("type must be keyword or regex");
				process.exit(1);
			}
			if (!opts.value) {
				printError("--value is required (the reply text or emoji)");
				process.exit(1);
			}
			if (!["reply", "react"].includes(opts.action)) {
				printError("--action must be reply or react");
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
				if (r.ok) {
					chat = r.jid;
				} else {
					printError(`Unknown chat "${chat}" — scope stays unresolvable`);
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

				if (opts.json) {
					printJson({
						id,
						triggerType: type,
						triggerValue: trigger,
						action: opts.action,
						value: opts.value,
						chat,
						status: "created",
					});
					db.close();
					return;
				}

				if (opts.quiet) {
					printData(String(id));
					db.close();
					return;
				}

				printSuccess(
					`Rule #${id} added (${type}:${trigger} → ${opts.action}) [scope: ${chat}]`,
				);
			} catch (err) {
				printError(err instanceof Error ? err.message : String(err));
				db.close();
				process.exit(1);
			}
			db.close();
		});

	rule
		.command("remove <id>")
		.description("Delete a rule")
		.option("-q, --quiet", "suppress output")
		.option("--json", "output result as JSON")
		.action((id: string, opts: RuleMutationOptions) => {
			const numId = parseInt(id, 10);
			const db = openDatabase(loadConfig());
			const ok = new RuleStore(db).remove(numId);
			db.close();

			if (opts.json) {
				printJson({ id: numId, removed: ok });
				process.exit(ok ? 0 : 1);
			}

			if (ok) {
				printSuccess(`Rule #${numId} removed`, opts.quiet);
			} else {
				printError(`Rule #${numId} not found`);
			}
			process.exit(ok ? 0 : 1);
		});

	rule
		.command("on <id>")
		.description("Enable a rule")
		.option("-q, --quiet", "suppress output")
		.option("--json", "output result as JSON")
		.action((id: string, opts: RuleMutationOptions) => {
			const numId = parseInt(id, 10);
			const db = openDatabase(loadConfig());
			new RuleStore(db).setEnabled(numId, true);
			db.close();

			if (opts.json) {
				printJson({ id: numId, enabled: true });
				return;
			}
			printSuccess(`Rule #${numId} enabled`, opts.quiet);
		});

	rule
		.command("off <id>")
		.description("Disable a rule")
		.option("-q, --quiet", "suppress output")
		.option("--json", "output result as JSON")
		.action((id: string, opts: RuleMutationOptions) => {
			const numId = parseInt(id, 10);
			const db = openDatabase(loadConfig());
			new RuleStore(db).setEnabled(numId, false);
			db.close();

			if (opts.json) {
				printJson({ id: numId, enabled: false });
				return;
			}
			printSuccess(`Rule #${numId} disabled`, opts.quiet);
		});
}
