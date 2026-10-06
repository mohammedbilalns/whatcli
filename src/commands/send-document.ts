import { existsSync } from 'node:fs';
import type { Command } from 'commander';
import { withSocket, resolveOrThrow } from './with-socket.js';

export function registerSendDocumentCommand(program: Command): void {
  program
    .command('send-document <name> <path>')
    .description('Send a file as a document')
    .action((name: string, filePath: string) => sendDocument(name, filePath));
}

async function sendDocument(name: string, filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    process.exit(1);
  }
  await withSocket(async ({ service, db }) => {
    const resolved = resolveOrThrow(db, name);
    const sent = await service.sendDocument(resolved.jid, filePath); 
    console.log(` Document sent to ${resolved.label}`);
    console.log(`   id: ${sent.id}`);
  });
}
