import type { Command } from 'commander';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { loadConfig } from '../utils/config.js';
import { WhatsAppManager, type ManagerState } from '../whatsapp/manager.js';
import { registerMessageListener } from '../whatsapp/messages.js';
import { registerHistorySync } from '../whatsapp/history.js';
import { formatMessage } from '../utils/format.js';
import { openDatabase } from '../db/database.js';
import { MessageStore } from '../services/message-store.js';
import { ContactStore } from '../services/contact-store.js';
import { RuleStore } from '../services/rule-store.js';
import { RuleEngine } from '../services/rule-engine.js';
import { Automation } from '../services/automation.js';
import { MessageService } from '../services/message-service.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { IpcServer } from '../ipc/server.js';
import { logger } from '../utils/logger.js';

export function registerDaemonCommand(program: Command): void {
  program
    .command('daemon')
    .alias('watch')                      // old muscle memory still works
    .description('Run the service: owns the connection, stores messages, serves IPC')
    .option('-q, --quiet', 'do not print live messages')
    .action((opts: { quiet?: boolean }) => daemon(opts.quiet !== true));
}

async function daemon(verbose: boolean): Promise<void> {
  const config = loadConfig();
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  if (!(state.creds.registered || !!state.creds.me?.id)) {
    console.log('Not logged in — run "wacli login" first.');
    process.exit(1);
  }

  const stamp = () => new Date().toLocaleTimeString();
  const log = (msg: string) => console.log(`[${stamp()}] ${msg}`);

  const db = openDatabase(config);
  const store = new MessageStore(db);
  const contacts = new ContactStore(db);
  const ruleStore = new RuleStore(db);
  let ingested = 0;


  let service: MessageService | undefined;

  const manager = new WhatsAppManager({
    onQr: () => log('server asked for a QR — session may be dead; re-login required'),
    onStateChange: (s: ManagerState, detail?: string) => log(describe(s, detail)),
  });

  manager.onSocket((sock) => {
    service = new MessageService(new WhatsAppClient(sock), store);
    const automation = new Automation(
      new RuleEngine(ruleStore.activeRules()), ruleStore, service!, log,
    );

    registerMessageListener(sock, (message, { live }) => {
      try { store.saveMessage(message); ingested += 1; }
      catch (err) { logger.error({ err }, 'failed to store message'); }

      if (live) {
        if (verbose) console.log(formatMessage(message, (j) => contacts.displayName(j)));
        void automation.handle(message);
      }
    });

    registerHistorySync(sock, (batch) => {
      const stored = store.ingestHistory(batch);
      ingested += stored;
      log(`history sync: ${stored} messages, ${batch.chats.length} chats`);
    });

    sock.ev.on('contacts.update', (updates) => {
      for (const u of updates) if (u.id && u.notify) contacts.upsertName(u.id, u.notify);
    });
    sock.ev.on('group-participants.update', ({ id, participants, action }) => {
      log(`group ${id.slice(-8)}: ${participants.map((p) => contacts.jidDisplayName(p.id)).join(', ')} — ${action}`);
    });
    sock.ev.on('groups.update', (updates) => {
      for (const u of updates) if (u.id && u.subject) { store.updateChatName(u.id, u.subject); log(`group renamed: ${u.subject}`); }
    });
  });

  // ---- IPC: the whole outbound surface, mapped to the live service ----
  const ipc = new IpcServer(config.ipcPath, async (method, p) => {
    const params = p as Record<string, never>; // narrow per-method below
    switch (method) {
      case 'ping':
        return { state: 'up', ingested };
      case 'send.text':     return service!.sendText(params.jid, params.text);
      case 'send.reply':    return service!.sendReply(params.jid, params.target, params.text);
      case 'send.reaction': return service!.sendReaction(params.jid, params.target, params.emoji);
      case 'send.image':    return service!.sendImage(params.jid, params.filePath, params.caption ?? undefined);
      case 'send.document': return service!.sendDocument(params.jid, params.filePath);
      case 'media.download': {
        const raw = { key: params.key, message: params.message } as import('@whiskeysockets/baileys').WAMessage;
        const { buffer, mediaJson } = await service!.downloadMediaVia(raw); // see note below
        return { b64: buffer.toString('base64'), mediaJson };
      }
      case 'group.info':    return service!.groupInfo(params.jid);
      case 'lookup':        return service!.lookupPhone(params.phone);
      case 'stop':
        log('stop requested via ipc');
        void graceful();
        return { stopping: true };
      default:
        throw new Error(`unknown method: ${method}`);
    }
  }, log);

  async function graceful(): Promise<void> {
    log(`shutting down (${ingested} messages this session)`);
    await ipc.stop();
    await manager.stop();
    await saveCreds();
    db.close();
    process.exit(0);
  }
  process.on('SIGINT', () => void graceful());

  await ipc.start();       
  await manager.start(state, saveCreds, config.authDir);
  process.exit(0);
}

function describe(s: ManagerState, detail?: string): string {
  return s === 'connecting' ? 'connecting…'
    : s === 'connected' ? 'connected'
    : s === 'reconnecting' ? 'reconnecting…'
    : s === 'waiting' ? `disconnected — ${detail}`
    : s === 'stopped' ? `stopped — ${detail}`
    : `logged out — ${detail}`;
}
