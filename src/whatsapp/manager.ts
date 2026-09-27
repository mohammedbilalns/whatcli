import { rmSync } from 'node:fs';
import type { AuthenticationState, WASocket } from '@whiskeysockets/baileys';
import { createSocket, awaitOpenOrClose, nextClose, type ConnectOptions } from './connect.js';
import { decideReconnect, DEFAULT_POLICY, type ReconnectPolicy } from './reconnect.js';

export type ManagerState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'waiting'
  | 'stopped'
  | 'logged-out';

export interface ManagerOptions extends ConnectOptions {
  onStateChange?: (state: ManagerState, detail?: string) => void;
  policy?: ReconnectPolicy;
}

export class WhatsAppManager {
  private socketHandlers: Array<(sock: WASocket) => void> = [];
  private stopping = false;
  private currentSocket?: WASocket;
  private run?: Promise<void>;
  private wake?: () => void;

  constructor(private readonly options: ManagerOptions = {}) {}

  /** Register a handler that re-attaches to every new socket on reconnect. */
  onSocket(handler: (sock: WASocket) => void): void {
    this.socketHandlers.push(handler);
  }

  async start(auth: AuthenticationState, saveCreds: () => Promise<void> | void, authDir: string): Promise<void> {
    this.run = this.loop(auth, saveCreds, authDir);
    await this.run;
  }

  /** Graceful stop: close socket, interrupt backoff, await loop exit. */
  async stop(): Promise<void> {
    this.stopping = true;
    this.wake?.();
    try { await this.currentSocket?.end(undefined); } catch {}
    await this.run;
  }

  private async loop(
    auth: AuthenticationState,
    saveCreds: () => Promise<void> | void,
    authDir: string,
  ): Promise<void> {
    const policy = this.options.policy ?? DEFAULT_POLICY;
    let attempt = 0;

    while (!this.stopping) {
      this.set(attempt === 0 ? 'connecting' : 'reconnecting');

      const sock = createSocket(auth, saveCreds);
      this.currentSocket = sock;
      for (const handler of this.socketHandlers) handler(sock); // re-attach

      // Watch for close before awaiting open — catches fast death.
      const closed = nextClose(sock);
      const outcome = await awaitOpenOrClose(sock, {
        onQr: this.options.onQr,
        timeoutMs: this.options.timeoutMs ?? 60_000,
      });

      let code: number;

      if (outcome.status === 'connected') {
        attempt = 0;                       // reset backoff on success
        this.set('connected');
        const close = await closed;        // parked here while connected
        this.currentSocket = undefined;
        if (this.stopping) break;
        code = close.code;
      } else if (outcome.status === 'closed') {
        this.currentSocket = undefined;
        code = outcome.code;
      } else {
        // timeout
        try { await sock.end(undefined); } catch {}
        this.currentSocket = undefined;
        code = -1;
      }

      const decision = decideReconnect(code, attempt, policy);
      attempt += 1;

      if (decision.action === 'stop') {
        this.set('stopped', decision.reason);
        return;
      }
      if (decision.action === 'wipe-and-stop') {
        rmSync(authDir, { recursive: true, force: true });
        this.set('logged-out', decision.reason);
        return;
      }
      if (this.stopping) break;

      this.set('waiting', `retry #${attempt} in ${Math.round(decision.delayMs / 1000)}s`);
      await this.sleepInterruptible(decision.delayMs);
    }

    this.set('stopped', 'stopped by user');
  }

  /** Sleep that can be interrupted by stop(). */
  private sleepInterruptible(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.wake = undefined; resolve(); }, ms);
      this.wake = () => { clearTimeout(timer); resolve(); };
    });
  }

  private set(state: ManagerState, detail?: string): void {
    this.options.onStateChange?.(state, detail);
  }
}
