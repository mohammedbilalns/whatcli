import type { Command } from "commander";
import { IpcClient } from "../ipc/client.js";
import { loadConfig } from "../utils/config.js";
import { printError, printJson, printSuccess } from "../utils/output.js";

interface StopOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerStopCommand(program: Command): void {
	program
		.command("stop")
		.description("Stop a running wacli daemon")
		.option("-q, --quiet", "suppress output")
		.option("--json", "output result as JSON")
		.action(async (opts: StopOptions) => {
			const config = loadConfig();
			const ipc = new IpcClient(config.ipcPath);
			if (!(await ipc.alive())) {
				if (opts.json) {
					printJson({ stopped: false, running: false });
					process.exit(1);
				}
				printError("No daemon running.");
				process.exit(1);
			}
			await ipc.request("stop");
			if (opts.json) {
				printJson({ stopped: true, running: false });
				return;
			}
			printSuccess("Daemon stopped.", opts.quiet);
		});
}
