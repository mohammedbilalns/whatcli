import type { Command } from 'commander';
import { withSocket, resolveOrThrow, UserError } from './with-socket.js';
import { isGroupChat, jidLabel} from '../whatsapp/jid.js';

export function registerGroupCommand(program: Command): void {
  const group = program.command('group').description('Group operations');
  group
    .command('info <name>')
    .description('Show members and admins of a group (live fetch)')
    .action((name: string) => groupInfo(name));
}

async function groupInfo(name: string): Promise<void> {
  await withSocket(async ({ service, store, db }) => {
    const resolved = resolveOrThrow(db, name);
    if (!isGroupChat(resolved.jid)) {
      throw new UserError(`"${resolved.label}" is not a group.`);
    }

    const info = await service.groupInfo(resolved.jid);
    if (info.name && info.name !== resolved.jid) {
      store.updateChatName(resolved.jid, info.name); // keep the stored name fresh
    }

    // Enrich participants from the contacts table (LID names live there)
    const withNames = info.participants.map((p) => ({
      ...p,
      name: store.contactName(p.jid) ?? undefined,
    }));
    const admins = withNames.filter((p) => p.role !== 'member');
    const members = withNames.filter((p) => p.role === 'member');
    const byName = (a: { name?: string; jid: string }, b: { name?: string; jid: string }) =>
      (a.name ?? a.jid).localeCompare(b.name ?? b.jid);

    console.log(info.name);
    console.log('─'.repeat(50));
    console.log(`Members: ${withNames.length}   Admins: ${admins.length}`);
    if (info.announceOnly) console.log('🔒 announce-only (admins can send)');
    if (info.description) {
      const desc = info.description.length > 120 ? info.description.slice(0, 117) + '…' : info.description;
      console.log(`\n${desc}`);
    }

    console.log('\nParticipants');
    console.log('─'.repeat(50));
    for (const p of [...admins.sort(byName), ...members.sort(byName)]) {
      const label = p.name ?? jidLabel(p.jid);
      const role = p.role === 'member' ? '' : `   ${p.role === 'superadmin' ? 'Owner' : 'Admin'}`;
      console.log(`${label.slice(0, 34).padEnd(36)}${role}`);
    }
  });
}
