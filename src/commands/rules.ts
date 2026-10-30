import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { RuleStore } from "../services/rule-store.js";
import { loadConfig } from "../utils/config.js";
import { printInfo, printJson, printTable } from "../utils/output.js";

interface RulesOptions {
	json?: boolean;
	plain?: boolean;
}

export function registerRulesCommand(program: Command): void {
	program
		.command("rules")
		.description("List automation rules")
		.option("--json", "output automation rules as JSON")
		.option("--plain", "output plain tab-separated values without formatting")
		.action((opts: RulesOptions) => {
			const db = openDatabase(loadConfig());
			const rows = new RuleStore(db).allRules();
			db.close();

			if (opts.json) {
				printJson(rows);
				return;
			}

			if (rows.length === 0) {
				printInfo(
					'No rules. Create one: wacli rule add keyword hello "Hi there!"',
				);
				return;
			}
			const tableData = rows.map((r) => {
				const trig = `${r.triggerType}:${r.triggerValue}`.slice(0, 26);
				const on = r.enabled ? "✓" : "·";
				const action = `${r.action} "${r.value.slice(0, 20)}" (${r.hitCount} hits)`;
				return [String(r.id), on, trig, action];
			});
			printTable(["ID", "ON", "TRIGGER", "ACTION"], tableData, {
				plain: opts.plain,
			});
		});
}
