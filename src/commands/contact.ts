import { Command } from "commander";
import { openDatabase } from "../db/database.js";
import { loadConfig } from "../utils/config.js";
import { ContactStore } from "../services/contact-store.js";
import { withSocket } from "./with-socket.js";
import { resolveChat } from "../whatsapp/jid.js";

export function registerContactCommand(program: Command): void {
  const contact = program.command('contact').description('Contact operations');
  contact.command('rename <target> <alias...>')
    .description('Set a local alias (empty "" clears). Alias wins over every other name.')
    .action((target: string, alias: string[]) => rename(target, alias.join(' ')));
  contact.command('lookup <phone>')
    .description('Live lookup: does this number have WhatsApp, and what are its JIDs?')
    .action((phone: string) => lookup(phone));
}

async function rename(target: string, alias: string): Promise<void> {
  const db = openDatabase(loadConfig());
  const store = new ContactStore(db);
  const clean = alias.trim() || null;

  // resolve: exact contact, fuzzy contact, then chat tail/name
  let row = store.byJid(target);
  if (!row) {
    const found = store.findByText(target);
    const chatsHit = resolveChat(db, target); 
    const jid = found.length === 1 ? found[0]!.jid : chatsHit?.ok ? chatsHit.jid : undefined;
    if (!jid) { console.log(`Nothing matching "${target}".`); db.close(); process.exit(1); }
    db.prepare('INSERT OR IGNORE INTO contacts (jid) VALUES (?)').run(jid);
    row = store.byJid(jid);
  }
  store.setAlias(row!.jid, clean);
  console.log(clean ? ` ${row!.jid} → "${clean}"` : `alias cleared for ${row!.jid}`);
  db.close();
}

async function lookup(phone: string): Promise<void> {
  const digits = phone.replace(/\D/g, '');
if (digits.length < 10) {
    console.log('That does not look like a phone number (use full international format).');
    process.exit(1);
  }
  await withSocket(async ({ service }) => {
    const results = await service.lookupPhone(digits); 
    if(!results || results.length === 0) {
      console.log('No WhatsApp account for that number.');
      return 
    }
    for (const r of results) {
      console.log(`jid:    ${r.jid}`);
      if ('lid' in r && r.lid) console.log(`lid:    ${r.lid}`);
      console.log(`exists: ${r.exists}`);
    }
    if (results.length === 0) console.log('No WhatsApp account for that number.');
  });
}
