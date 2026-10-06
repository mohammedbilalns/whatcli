import type { Command } from 'commander';
import { loadConfig } from '../utils/config.js';
import { openDatabase } from '../db/database.js';
import { RuleStore } from '../services/rule-store.js';
import { printTable, printInfo } from '../utils/output.js';

export function registerRulesCommand(program: Command): void {
  program.command('rules').description('List automation rules').action(() => {
    const db = openDatabase(loadConfig());
    const rows = new RuleStore(db).allRules();
    db.close();
    if (rows.length === 0) { 
      printInfo('No rules. Create one: wacli rule add keyword hello "Hi there!"'); 
      return; 
    }
    const tableData = rows.map(r => {
      const trig = `${r.triggerType}:${r.triggerValue}`.slice(0, 26);
      const on = r.enabled ? '✓' : '·';
      const action = `${r.action} "${r.value.slice(0, 20)}" (${r.hitCount} hits)`;
      return [String(r.id), on, trig, action];
    });
    printTable(['ID', 'ON', 'TRIGGER', 'ACTION'], tableData);
  });
}
