import type { Command } from 'commander';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { loadConfig } from '../utils/config.js';
import { WhatsAppManager } from '../whatsapp/manager.js';
import { registerMessageListener } from '../whatsapp/messages.js';
import { formatMessage } from '../utils/format.js';

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Stay connected and show the connection lifecycle (Ctrl+C to stop)')
    .action(() => watch());
}

async function watch(): Promise<void> {
  const config = loadConfig();
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

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

  // fires on EVERY socket, including post-reconnect ones.
  manager.onSocket((sock) => {
    registerMessageListener(sock, (message) => console.log(formatMessage(message)))
    sock.ev.on('connection.update', (u) => {
      if (u.receivedPendingNotifications) log('history sync complete');
    });
  });

  process.on('SIGINT', () => {
    void (async () => {
      await manager.stop();
      await saveCreds();
      process.exit(0);
    })();
  });

  await manager.start(state, saveCreds, config.authDir);
  process.exit(0);
}
