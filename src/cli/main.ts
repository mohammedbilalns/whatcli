#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { baileysLogger, logger } from "../utils/logger.js";
import { registerCommands } from "./commands.js";

// Gracefully handle broken pipes (e.g. wacli ... | head -n 5)
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
	if (err.code === "EPIPE") {
		process.exit(0);
	}
});
process.stderr.on("error", (err: NodeJS.ErrnoException) => {
	if (err.code === "EPIPE") {
		process.exit(0);
	}
});

process.on("SIGINT", () => {
	process.exit(130);
});
process.on("SIGTERM", () => {
	process.exit(143);
});

const pkgPath = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"package.json",
);

const { version } = JSON.parse(readFileSync(pkgPath, "utf8")) as {
	version: string;
};

const program = new Command();

program
	.name("wacli")
	.description("Whatsapp in your terminal")
	.version(version)
	.showSuggestionAfterError()
	.option("-d, --debug", "enable debug logging")
	.hook("preAction", (thisCommand) => {
		if (thisCommand.opts().debug) {
			logger.level = "debug";
			baileysLogger.level = "debug";
		}
	});

registerCommands(program);

try {
	await program.parseAsync(process.argv);
} catch (err: unknown) {
	if ((err as NodeJS.ErrnoException)?.code === "EPIPE") {
		process.exit(0);
	}
	if (err instanceof Error) {
		logger.error(err.message);
		if (program.opts().debug) {
			console.error(err.stack);
		}
	} else {
		logger.error(String(err));
	}
	process.exit(1);
}
