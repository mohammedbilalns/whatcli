import type { Command } from "commander";
import { withSocket, resolveOrThrow, UserError } from "./with-socket.js";

export function registerReplyCommand(program: Command): void {
	program
		.command("reply <name> <messageId> <text...>")
		.description(
			"Reply to a message (find IDs with: wacli history <name> --ids)",
		)
		.action((name: string, messageId: string, text: string[]) =>
			reply(name, messageId, text.join(" ")),
		);
}

async function reply(
	name: string,
	messageId: string,
	text: string,
): Promise<void> {
	if (!text.trim()) throw new UserError("Reply text is empty.");

	await withSocket(async ({ service, store, db }) => {
		const resolved = resolveOrThrow(db, name);

		const row = store.getMessageById(messageId);
		if (!row)
			throw new UserError(
				`No stored message with id ${messageId} — try "wacli history ${name} --ids".`,
			);
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

		console.log(`✅ Replied in ${resolved.label}`);
		console.log(`   id: ${sent.id}`);
	});
}
