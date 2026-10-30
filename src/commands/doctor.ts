import process from "node:process";
import type { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import {
	printData,
	printError,
	printJson,
	printSuccess,
} from "../utils/output.js";

interface DoctorOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerDoctorCommand(program: Command): void {
	program
		.command("doctor")
		.description("Sanity-check config, data dir, SQLite and logging")
		.option(
			"-q, --quiet",
			"silent check; exit code 0 if all checks pass, 1 if failed",
		)
		.option("--json", "output doctor report as JSON")
		.action((opts: DoctorOptions) => {
			const config = loadConfig();
			let sqliteOk = false;
			let sqliteRoundtrip: string | null = null;
			let sqliteError: string | null = null;

			try {
				const db = openDatabase(config);
				const CHECKIN_KEY = "checked_at";

				db.exec(
					"CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)",
				);
				db.prepare(
					"INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
				).run(CHECKIN_KEY, new Date().toISOString());
				const row = db
					.prepare("SELECT value FROM meta WHERE key = ?")
					.get(CHECKIN_KEY) as { value: string } | undefined;
				db.close();

				if (row) {
					sqliteOk = true;
					sqliteRoundtrip = row.value;
				} else {
					sqliteError = "no row found";
				}
			} catch (err) {
				sqliteError = err instanceof Error ? err.message : String(err);
			}

			const allPassed = sqliteOk;

			if (opts.quiet) {
				process.exit(allPassed ? 0 : 1);
			}

			if (opts.json) {
				printJson({
					passed: allPassed,
					node: process.version,
					dataDir: config.dataDir,
					sqlite: {
						ok: sqliteOk,
						roundtrip: sqliteRoundtrip,
						error: sqliteError,
					},
				});
				process.exit(allPassed ? 0 : 1);
			}

			if (process.stdout.isTTY) {
				printData("wacli doctor\n--------------------------");
			}
			printData(`node: ${process.version}`);
			printData(`dataDir: ${config.dataDir}`);

			if (!sqliteOk) {
				printError(`sqlite: FAILED (${sqliteError})`);
				process.exit(1);
			}

			printData(`sqlite: ok (round-trip: ${sqliteRoundtrip})`);
			logger.info("pino logger works");
			printSuccess("all checks passed");
		});
}
