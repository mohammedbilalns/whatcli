import { existsSync, readFileSync, unlinkSync } from "node:fs";
import type { Command } from "commander";
import { IpcClient } from "../ipc/client.js";
import { loadConfig } from "../utils/config.js";
import { printError, printJson, printSuccess } from "../utils/output.js";

interface StopOptions {
	force?: boolean;
	quiet?: boolean;
	json?: boolean;
}

export function registerStopCommand(program: Command): void {
	program
		.command("stop")
		.description("Stop a running wacli daemon")
		.option(
			"-f, --force",
			"force stop via process SIGTERM/SIGKILL if unresponsive",
		)
		.option("-q, --quiet", "suppress output")
		.option("--json", "output result as JSON")
		.action(async (opts: StopOptions) => {
			const config = loadConfig();
			const ipc = new IpcClient(config.ipcPath);

			let pid: number | null = null;
			if (existsSync(config.pidPath)) {
				try {
					pid = Number(readFileSync(config.pidPath, "utf8").trim());
				} catch {}
			}

			if (opts.force && pid) {
				try {
					process.kill(pid, "SIGTERM");
					if (existsSync(config.pidPath)) unlinkSync(config.pidPath);
					if (existsSync(config.ipcPath)) unlinkSync(config.ipcPath);
					if (opts.json) {
						printJson({ stopped: true, forced: true, pid });
						return;
					}
					printSuccess(`Daemon process (PID ${pid}) killed.`, opts.quiet);
					return;
				} catch (err) {
					printError(
						`Failed to kill PID ${pid}: ${err instanceof Error ? err.message : String(err)}`,
					);
					process.exit(1);
				}
			}

			if (!(await ipc.alive())) {
				if (pid) {
					// Check if stale pid file or dead process
					try {
						process.kill(pid, 0); // throws if process is dead
					} catch {
						if (existsSync(config.pidPath)) unlinkSync(config.pidPath);
					}
				}

				if (opts.json) {
					printJson({ stopped: false, running: false });
					process.exit(1);
				}
				printError("No daemon running.");
				process.exit(1);
			}

			try {
				await ipc.request("stop", {}, 5000);
			} catch (err) {
				if (opts.force && pid) {
					try {
						process.kill(pid, "SIGKILL");
						if (existsSync(config.pidPath)) unlinkSync(config.pidPath);
						if (existsSync(config.ipcPath)) unlinkSync(config.ipcPath);
						if (opts.json) {
							printJson({ stopped: true, forced: true, pid });
							return;
						}
						printSuccess(
							`Daemon process (PID ${pid}) forcefully terminated.`,
							opts.quiet,
						);
						return;
					} catch {}
				}
				printError(
					`Failed to stop daemon cleanly: ${err instanceof Error ? err.message : String(err)}`,
				);
				process.exit(1);
			}

			if (opts.json) {
				printJson({ stopped: true, running: false, pid });
				return;
			}
			printSuccess("Daemon stopped.", opts.quiet);
		});
}
