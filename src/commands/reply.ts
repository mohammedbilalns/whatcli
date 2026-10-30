import type { Command } from "commander";
import {
	printData,
	printError,
	printJson,
	printSuccess,
} from "../utils/output.js";
import { isStdinPiped, readStdinText } from "../utils/stdin.js";
import { resolveOrThrow, UserError, withSocket } from "./with-socket.js";

interface ReplyOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerReplyCommand(program: Command): void {
	program
		.command("reply <name> <messageId> [text...]")
		.description(
			"Reply to a message (find IDs with: wacli history <name> --ids; reads from stdin if omitted or '-')",
		)
		.option(
			"-q, --quiet",
			"suppress status output and only output the sent message ID",
		)
		.option("--json", "output result as JSON")
		.action(
			async (
				name: string,
				messageId: string,
				textParts: string[],
				opts: ReplyOptions,
			) => {
				let messageText = textParts.join(" ").trim();
				if (messageText === "-" || (!messageText && isStdinPiped())) {
					messageText = await readStdinText();
				}

				if (!messageText) {
					printError(
						'Reply text is empty. Provide text as an argument or pipe via stdin (e.g. echo "hi" | wacli reply <name> <id>).',
					);
					process.exit(1);
				}

				await reply(name, messageId, messageText, opts);
			},
		);
}

async function reply(
	name: string,
	messageId: string,
	text: string,
	opts: ReplyOptions,
): Promise<void> {
	await withSocket(async ({ service, store, db }) => {
		const resolved = resolveOrThrow(db, name);

		const row = store.getMessageById(messageId);
		if (!row) {
			throw new UserError(
				`No stored message with id ${messageId} — try "wacli history ${name} --ids".`,
			);
		}
		if (row.chat_id !== resolved.jid) {
			throw new UserError(
				`That message belongs to a different chat (${row.chat_id}) than "${name}".`,
			);
		}

		const sent = await service.sendReply(
			resolved.jid,
			{
				id: row.id,
				fromMe: row.from_me === 1,
				senderId: row.sender_id,
				text: row.text ?? undefined,
			},
			text,
		);

		if (opts.json) {
			printJson({
				id: sent.id,
				replyToId: row.id,
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

		printSuccess(`Replied in ${resolved.label}`);
		printData(`id: ${sent.id}`);
	});
}
