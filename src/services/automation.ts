import type { Message } from '../models/message.js';
import type { RuleEngine } from './rule-engine.js';
import type { RuleStore } from './rule-store.js';
import type { MessageService } from './message-service.js';

const COOLDOWN_MS = 30_000;   

export class Automation {
  private readonly lastFired = new Map<number, number>();

  constructor(
    private readonly engine: RuleEngine,
    private readonly rules: RuleStore,
    private readonly service: MessageService,
    private readonly log: (line: string) => void = console.log,
  ) {}

  /** Called from the watch loop for every stored message. */
  async handle(msg: Message): Promise<void> {
    const hit = this.engine.match(msg);
    if (!hit) return;

    // cooldown (re-create the engine on rule changes resets this — acceptable for v1)
    const last = this.lastFired.get(hit.rule.id) ?? 0;
    if (Date.now() - last < COOLDOWN_MS) return;

    this.lastFired.set(hit.rule.id, Date.now());

    try {
      if (hit.rule.action === 'reply') {
        await this.service.sendReply(msg.chatId, {
          id: msg.id, fromMe: false, senderId: msg.senderId, text: msg.text,
        }, hit.rule.value);
      } else {
        await this.service.sendReaction(msg.chatId, {
          id: msg.id, fromMe: false, senderId: msg.senderId, text: msg.text,
        }, hit.rule.value);
      }
      this.rules.recordHit(hit.rule.id);
      this.log(`⚙️  rule #${hit.rule.id} ${hit.rule.triggerType}:"${hit.rule.triggerValue}" fired → ${hit.rule.action}`);
    } catch (err) {
      this.log(`⚙️  rule #${hit.rule.id} FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
}
