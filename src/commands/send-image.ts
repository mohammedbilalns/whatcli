import { existsSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import {
	printData,
	printError,
	printJson,
	printSuccess,
} from "../utils/output.js";
import { isStdinPiped, readStdinBuffer } from "../utils/stdin.js";
import { resolveOrThrow, withSocket } from "./with-socket.js";

interface SendImageOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerSendImageCommand(program: Command): void {
	program
		.command("send-image <name> <path> [caption...]")
		.description(
			"Send an image with optional caption (use '-' as path to pipe image data from stdin)",
		)
		.option(
			"-q, --quiet",
			"suppress status output and only output the sent message ID",
		)
		.option("--json", "output result as JSON")
		.action(
			(
				name: string,
				filePath: string,
				caption: string[],
				opts: SendImageOptions,
			) => sendImage(name, filePath, caption.join(" "), opts),
		);
}

async function sendImage(
	name: string,
	filePath: string,
	caption: string,
	opts: SendImageOptions,
): Promise<void> {
	let tempFile: string | null = null;
	let resolvedPath = filePath;

	if (filePath === "-") {
		if (!isStdinPiped()) {
			printError("No image data provided on stdin.");
			process.exit(1);
		}
		const buf = await readStdinBuffer();
		if (buf.length === 0) {
			printError("Image data from stdin is empty.");
			process.exit(1);
		}
		tempFile = path.join(os.tmpdir(), `wacli-img-${Date.now()}.bin`);
		writeFileSync(tempFile, buf);
		resolvedPath = tempFile;
	} else if (!existsSync(filePath)) {
		printError(`File not found: ${filePath}`);
		process.exit(1);
	}

	try {
		await withSocket(async ({ service, db }) => {
			const resolved = resolveOrThrow(db, name);
			const sent = await service.sendImage(
				resolved.jid,
				resolvedPath,
				caption || undefined,
			);

			if (opts.json) {
				printJson({
					id: sent.id,
					to: resolved.label,
					jid: resolved.jid,
					status: "sent",
					caption: caption || undefined,
					timestamp: sent.timestamp.toISOString(),
				});
				return;
			}

			if (opts.quiet) {
				printData(sent.id);
				return;
			}

			printSuccess(`Image sent to ${resolved.label}`);
			printData(`id: ${sent.id}`);
		});
	} finally {
		if (tempFile && existsSync(tempFile)) {
			try {
				rmSync(tempFile);
			} catch {}
		}
	}
}
