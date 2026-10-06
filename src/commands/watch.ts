import type { Command } from 'commander';
import { useSqliteAuthState } from '../whatsapp/auth.js';
import { loadConfig } from '../utils/config.js';
import { WhatsAppManager } from '../whatsapp/manager.js';
import { registerMessageListener } from '../whatsapp/messages.js';
import { formatMessage } from '../utils/format.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { logger } from '../utils/logger.js';
import { registerHistorySync } from '../whatsapp/history.js';
import { jidLabel } from '../whatsapp/jid.js';
import { ContactStore } from '../services/contact-store.js';
import { RuleStore } from '../services/rule-store.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { MessageService } from '../services/message-service.js';
import { RuleEngine } from '../services/rule-engine.js';
import { Automation } from '../services/automation.js';

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Stay connected and show the connection lifecycle (Ctrl+C to stop)')
    .action(() => watch());
}

async function watch(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config);
  const { state, saveCreds } = await useSqliteAuthState(db);

  const hasSession = state.creds.registered || !!state.creds.me?.id;
  if (!hasSession) {
    console.log('Not logged in — run "wacli login" first.');
    process.exit(1);
  }



  const stamp = () => new Date().toLocaleTimeString();
  const log = (msg: string) => console.log(`[${stamp()}] ${msg}`);

  const manager = new WhatsAppManager({
    onQr: () => log(' server asked for a QR — session may be dead; re-login required'),
    onStateChange: (s, detail) => {
      const line =
        s === 'connecting'   ? 'connecting…' :
          s === 'connected'    ? 'connected' :
            s === 'reconnecting' ? 'reconnecting…' :
              s === 'waiting'      ? `disconnected — ${detail}` :
                s === 'stopped'      ? `stopped — ${detail}` :
                  `logged out — ${detail}`;
      log(line);
    },
  });


  const store = new MessageStore(db)
  const contacts = new ContactStore(db);     
  const ruleStore = new RuleStore(db)

  let ingested = 0 
  log(`storing to ${config.dbPath}`)
  // fires on EVERY socket, including post-reconnect ones.
  manager.onSocket((sock) => {

    const client = new WhatsAppClient(sock);                  // outbound, per-socket
     const service = new MessageService(client, store);        // watch's own service
     const engine = new RuleEngine(ruleStore.activeRules());   // snapshot per socket
     const automation = new Automation(engine, ruleStore, service, log);
   
    registerMessageListener(sock, (message, {live}) =>{
      try {
        store.saveMessage(message)
        ingested += 1 
      } catch (err) {
        logger.error({err}, 'failed to store message')
      }

      if (live){
        console.log(formatMessage(message, (j) => contacts.displayName(j))); 
        void automation.handle(message)
      } 
    })

    sock.ev.on('contacts.update', (updates) => {
      for (const u of updates) {
        if (u.id && u.notify) contacts.upsertName(u.id, u.notify);
      }
    });

    sock.ev.on('group-participants.update', ({ id, participants, action }) => {
      const who = participants
        .map((p) => contacts.jidDisplayName(p.id))   // ← was store.contactName ?? jidLabel
        .join(', ');
      log(`group ${jidLabel(id)}: ${who} — ${action}`);
    });

sock.ev.on('groups.update', (updates) => {
  for (const u of updates) {
    if (u.id && u.subject) {
      store.updateChatName(u.id, u.subject);
      log(`group renamed: ${u.subject}`);
    }
  }
});

    registerHistorySync(sock , (batch) => {
      const stored = store.ingestHistory(batch)
      ingested += stored
      log(`history sync: ${stored} messages, ${batch.chats.length} chats, ${batch.contacts.length} contacts `)
    })

    sock.ev.on('connection.update', (u) => {
      if (u.receivedPendingNotifications) log('history sync complete');
    });

  });

  process.on('SIGINT', () => {
    void (async () => {
      await manager.stop();
      await saveCreds();
      db.close()
      process.exit(0);
    })();
  });

  await manager.start(
    state,
    saveCreds,
    () => {
      db.prepare('DELETE FROM auth_state').run();
    },
    async (key) => store.getRawMessage(key.id!)
  );
  process.exit(0);
}
