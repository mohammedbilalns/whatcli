import { Command } from "commander";
import { loadConfig } from "../utils/config.js";
import { openDatabase } from "../db/database.js";
import { logger } from "../utils/logger.js";

export function registerDoctorCommand(program : Command): void {
  program.command('doctor')
    .description(`Sanity-check config, data dir, SQLite and logging`)
    .action(() => {
      const config = loadConfig()

      console.log('wacli doctor')
      console.log('--------------------------')
      console.log(`node: ${process.version}`)
      console.log(`dataDir: ${config.dataDir}`)


      const db = openDatabase(config)


      const CHECKIN_KEY = 'checked_at';

      db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
        .run(CHECKIN_KEY, new Date().toISOString());
      const row = db.prepare('SELECT value FROM meta WHERE key = ?')
        .get(CHECKIN_KEY) as { value: string } | undefined;
      db.close();

      if (!row) {
        console.log('sqlite: FAILED (no row found)');
        process.exitCode = 1;
        return;
      }

      console.log(`sqlite: ok (round-trip: ${row.value})`);
      logger.info('pino logger works')
      console.log(`\n checks passed`)
    })

}
