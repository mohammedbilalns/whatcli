import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { RuleStore } from '../services/rule-store.js';
import { resolveChat } from '../whatsapp/jid.js';
import { TriggerType, ActionType } from '../models/rules.js';

export function registerRuleCommand(program: Command): void {
  const rule = program.command('rule').description('Manage automation rules');

  rule
    .command('add <type> <trigger...>')   // variadic: trigger may contain spaces
    .description('Add a rule. type: keyword|regex. Use -- for the prompt:')
    .option('-a, --action <action>', 'reply or react', 'reply')
    .option('-v, --value <value>', 'reply text or emoji')
    .option('-c, --chat <chat>', "scope: '*', 'direct', or a chat name/JID", '*')
    .action((type: string, triggerParts: string[], opts: { action: string; value?: string; chat: string }) => {
      const trigger = triggerParts.join(' ');
      if (!['keyword', 'regex'].includes(type)) { console.log('type must be keyword or regex'); process.exit(1); }
      if (!opts.value) { console.log('--value is required (the reply text or emoji)'); process.exit(1); }
      if (!['reply', 'react'].includes(opts.action)) { console.log('--action must be reply or react'); process.exit(1); }

      const db = openDatabase(loadConfig());
      let chat = opts.chat;
      if (chat !== '*' && chat !== 'direct') {
        const r = resolveChat(db, chat);
        if (r.ok) chat = r.jid;              // store the JID, not the name — names drift, JIDs don't
        else { console.log(`Unknown chat "${chat}" — scope stays unresolvable`); db.close(); process.exit(1); }
      }
      try {
        const id = new RuleStore(db).add({
          triggerType: type as TriggerType, triggerValue: trigger,
          action: opts.action as ActionType, value: opts.value, chat,
        });
        console.log(`✅ Rule #${id} added (${type}:${trigger} → ${opts.action}) [scope: ${chat}]`);
      } catch (err) {
        console.log(`❌ ${err instanceof Error ? err.message : err}`);   // e.g. invalid regex
        process.exit(1);
      }
      db.close();
    });

  rule.command('remove <id>')
    .description('Delete a rule')
    .action((id: number) => { /* RuleStore.remove, print result, exit code */ });

  rule.command('on <id>').action((id: number) => { /* setEnabled(id, true) */ });
  rule.command('off <id>').action((id: number) => { /* setEnabled(id, false) */ });
}
