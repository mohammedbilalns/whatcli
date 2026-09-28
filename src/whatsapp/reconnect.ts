import { DisconnectReason } from "@whiskeysockets/baileys";

export type ReconnectDecision = 
| {action :'retry'; delayMs : number}
| {action: 'stop'; reason: string}
| {action: 'wipe-and-stop'; reason: string}

export interface ReconnectPolicy {
  maxRetries: number,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
}

export const DEFAULT_POLICY: ReconnectPolicy = {
  maxRetries: 8,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000
} 

export function decideReconnect(
  code: number,
  attempt: number,
  policy: ReconnectPolicy = DEFAULT_POLICY
): ReconnectDecision {
  const delayMs = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt)

  // Session is dead server-side.
  if (code == DisconnectReason.loggedOut){
    return {action: 'wipe-and-stop', reason: 'logged out (invalidated from the phone)'}
  }

  // Local auth state is unusable.
  if(code === DisconnectReason.badSession || code == DisconnectReason.multideviceMismatch){
    return {action: 'wipe-and-stop', reason: 'saved session '}
  }

  // Another process connected with these same credentials. 
  if(code === DisconnectReason.connectionReplaced){
    return {action: "stop", reason: 'connection replaced by another session'}
  }

  // Protocol-mandated fresh socket. 
  if(code === DisconnectReason.restartRequired  ){
    return {action: 'retry', delayMs: 0}
  }

  // Everything else.
  if(attempt >= policy.maxRetries){
    return {action: 'stop', reason: `gave up after ${attempt + 1} attempts (last code: ${code})`}
  }

  return { action: 'retry', delayMs };
}
