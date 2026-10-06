import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { RuleStore } from '../services/rule-store.js';

export function registerRulesCommand(program: Command): void {
  program.command('rules').description('List automation rules').action(() => {
    const db = openDatabase(loadConfig());
    const rows = new RuleStore(db).allRules();
    db.close();
    if (rows.length === 0) { console.log('No rules. Create one: wacli rule add keyword hello "Hi there!"'); return; }
    console.log(`${'ID'.padEnd(4)}${'ON'.padEnd(4)}${'TRIGGER'.padEnd(28)}ACTION`);
    console.log('─'.repeat(60));
    for (const r of rows) {
      const trig = `${r.triggerType}:${r.triggerValue}`.slice(0, 26);
      console.log(`${String(r.id).padEnd(4)}${r.enabled ? '✓' : '·'}${' '.padEnd(3)}${trig.padEnd(28)}${r.action} "${r.value.slice(0, 20)}" (${r.hitCount} hits)`);
    }
  });
}
