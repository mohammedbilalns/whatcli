import type { Command } from "commander";
import { printJson, printSuccess } from "../utils/output.js";
import { resolveOrThrow, UserError, withSocket } from "./with-socket.js";

interface ReactOptions {
	quiet?: boolean;
	json?: boolean;
}

export function registerReactCommand(program: Command): void {
	program
		.command("react <name> <messageId> <emoji>")
		.description('React to a message (empty string "" removes the reaction)')
		.option("-q, --quiet", "suppress confirmation message")
		.option("--json", "output result as JSON")
		.action(
			(name: string, messageId: string, emoji: string, opts: ReactOptions) =>
				react(name, messageId, emoji, opts),
		);
}

async function react(
	name: string,
	messageId: string,
	emoji: string,
	opts: ReactOptions,
): Promise<void> {
	if (emoji.length > 8)
		throw new UserError("That does not look like a single emoji."); // emoji can be multi-codepoint

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
				`That message belongs to a different chat than "${name}".`,
			);
		}

		await service.sendReaction(
			resolved.jid,
			{
				id: row.id,
				fromMe: row.from_me === 1,
				senderId: row.sender_id,
				text: row.text ?? undefined,
			},
			emoji,
		);

		if (opts.json) {
			printJson({
				targetId: row.id,
				chat: resolved.label,
				jid: resolved.jid,
				reaction: emoji,
				status: "reacted",
			});
			return;
		}

		printSuccess(`Reacted ${emoji} in ${resolved.label}`, opts.quiet);
	});
}
