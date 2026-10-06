import { existsSync } from "node:fs";
import type { Command } from "commander";
import { resolveOrThrow, withSocket } from "./with-socket.js";

export function registerSendImageCommand(program: Command): void {
	program
		.command("send-image <name> <path> [caption...]")
		.description("Send an image with optional caption")
		.action((name: string, filePath: string, caption: string[]) =>
			sendImage(name, filePath, caption.join(" ")),
		);
}

async function sendImage(
	name: string,
	filePath: string,
	caption: string,
): Promise<void> {
	if (!existsSync(filePath)) {
		console.log(`File not found: ${filePath}`);
		process.exit(1);
	}
	await withSocket(async ({ service, db }) => {
		const resolved = resolveOrThrow(db, name);
		const sent = await service.sendImage(
			resolved.jid,
			filePath,
			caption || undefined,
		);
		console.log(`Image sent to ${resolved.label}`);
		console.log(`   id: ${sent.id}`);
	});
}
