import type { Boom } from "@hapi/boom";
import type { Command } from "commander";
import {
	printData,
	printError,
	printJson,
	printSuccess,
} from "../utils/output.js";
import { isStdinPiped, readStdinText } from "../utils/stdin.js";
import { resolveOrThrow, UserError, withSocket } from "./with-socket.js";

interface SendOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerSendCommand(program: Command): void {
	program
		.command("send <name> [text...]")
		.description(
			"Send a text message to a chat (reads from stdin if omitted or '-')",
		)
		.option(
			"-q, --quiet",
			"suppress status output and only output the sent message ID",
		)
		.option("--json", "output result as JSON")
		.action(async (name: string, textParts: string[], opts: SendOptions) => {
			let messageText = textParts.join(" ").trim();
			if (messageText === "-" || (!messageText && isStdinPiped())) {
				messageText = await readStdinText();
			}

			if (!messageText) {
				printError(
					'Message text is empty. Provide text as an argument or pipe via stdin (e.g. echo "hi" | wacli send <name>).',
				);
				process.exit(1);
			}

			await send(name, messageText, opts);
		});
}

async function send(
	name: string,
	text: string,
	opts: SendOptions,
): Promise<void> {
	await withSocket(async ({ service, db }) => {
		const resolved = resolveOrThrow(db, name);

		try {
			const sent = await service.sendText(resolved.jid, text);

			if (opts.json) {
				printJson({
					id: sent.id,
					to: resolved.label,
					jid: resolved.jid,
					status: "sent",
					timestamp: sent.timestamp.toISOString(),
				});
				return;
			}

			if (opts.quiet) {
				printData(sent.id);
				return;
			}

			printSuccess(`Sent to ${resolved.label}`);
			printData(`id: ${sent.id}`);
		} catch (err) {
			const boom = err as Boom;
			const code = boom?.output?.statusCode
				? ` (${boom.output.statusCode})`
				: "";
			throw new UserError(
				`Send failed${code}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	});
}
