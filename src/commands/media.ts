import type { Command } from "commander";
import { printData, printJson, printSuccess } from "../utils/output.js";
import { withSocket } from "./with-socket.js";

interface DownloadOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerMediaCommand(program: Command): void {
	const media = program.command("media").description("Media operations");
	media
		.command("download <messageId>")
		.description(
			"Download a media message to data/media/ (IDs: wacli history <name> --ids)",
		)
		.option("-q, --quiet", "output only the saved file path")
		.option("--json", "output result as JSON")
		.action((messageId: string, opts: DownloadOptions) =>
			download(messageId, opts),
		);
}

async function download(
	messageId: string,
	opts: DownloadOptions,
): Promise<void> {
	await withSocket(async ({ service, config }) => {
		const target = await service.downloadAndSave(messageId, config.mediaDir);

		if (opts.json) {
			printJson({
				id: messageId,
				path: target,
				status: "downloaded",
			});
			return;
		}

		if (opts.quiet) {
			printData(target);
			return;
		}

		printSuccess(`Saved: ${target}`);
	});
}
