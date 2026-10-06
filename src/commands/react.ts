import type { Command } from 'commander';
import { withSocket, resolveOrThrow, UserError } from './with-socket.js';

export function registerReactCommand(program: Command): void {
  program
    .command('react <name> <messageId> <emoji>')
    .description('React to a message (empty string "" removes the reaction)')
    .action((name: string, messageId: string, emoji: string) => react(name, messageId, emoji));
}

async function react(name: string, messageId: string, emoji: string): Promise<void> {
  if (emoji.length > 8) throw new UserError('That does not look like a single emoji.'); // emoji can be multi-codepoint

  await withSocket(async ({ service, store, db }) => {
    const resolved = resolveOrThrow(db, name);

    const row = store.getMessageById(messageId);
    if (!row) throw new UserError(`No stored message with id ${messageId} — try "wacli history ${name} --ids".`);
    if (row.chat_id !== resolved.jid) {
      throw new UserError(`That message belongs to a different chat than "${name}".`);
    }

    await service.sendReaction(resolved.jid, {
      id: row.id,
      fromMe: row.from_me === 1,
      senderId: row.sender_id,
      text: row.text ?? undefined,
    }, emoji);

    console.log(`✅ Reacted ${emoji} in ${resolved.label}`);
  });
}
