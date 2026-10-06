import type { Command } from "commander";
import { withSocket } from "./with-socket.js";

export function registerMediaCommand(program: Command): void {
	const media = program.command("media").description("Media operations");
	media
		.command("download <messageId>")
		.description(
			"Download a media message to data/media/ (IDs: wacli history <name> --ids)",
		)
		.action((messageId: string) => download(messageId));
}

async function download(messageId: string): Promise<void> {
	await withSocket(async ({ service, config }) => {
		const target = await service.downloadAndSave(messageId, config.mediaDir);
		console.log(`Saved: ${target}`);
	});
}
