import { Command } from "commander";
import { loadConfig } from "../utils/config.js";
import { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { connectAndWait } from "../whatsapp/connect.js";
import { phoneFromJid } from "../whatsapp/jid.js";

export function registerStatusCommand(program: Command ): void {
  program
    .command('status')
    .description('Show Whatsapp connection status')
    .action(() => status())
}

/**
 * Checks the current WhatsApp connection status.
 */
async function status(): Promise<void>{
  const config = loadConfig()
  const {state, saveCreds}  = await useMultiFileAuthState(config.authDir)

  console.log('Whatsapp')
  console.log('--------------')

  /*
   * Check whether we have a WhatsApp session.
   *
   * `registered` indicates that the credentials have
   * been registered.
   *
   * `me?.id` indicates that Baileys knows which WhatsApp
   * account these credentials belong to.
   */
  const hasSession = state.creds.registered || !!state.creds.me?.id

  if(!hasSession){
    console.log('Status: Not logged in ')
    console.log('Run "wacli login" to connect. ')
    process.exit(1)
  }

 /*
   * Try connecting to WhatsApp using the saved session.
   */
  const {sock , outcome} = await connectAndWait(state, saveCreds, {
    timeoutMs: 30_000
  })

  /*
   * ─────────────────────────────────────────────
   * CONNECTED
   * ─────────────────────────────────────────────
   */
  if(outcome.status === 'connected'){
    const me = state.creds.me
    console.log('Status: Connected')
    console.log(`User: ${me?.id ? phoneFromJid(me.id) : 'unknown'}`)
    await sock.end(undefined)
    process.exit(0)
  }


  if(outcome.status === 'timeout'){
    console.log('Status: Offline (timed out reaching Whatsapp)')
    process.exit(1)
  }

  /*
   * ─────────────────────────────────────────────
   * CONNECTION CLOSED
   * ─────────────────────────────────────────────
   */

  /*
   * `loggedOut` means the WhatsApp session was
   * invalidated, so the saved credentials cannot
   * be used anymore.
   */

  if (outcome.code === DisconnectReason.loggedOut) {
    console.log('Status: Logged out (session invalidated from the phone)');
    console.log(`Fix:    rm -rf ${config.authDir} && wacli login`);
  } else {
    console.log(`Status: Disconnected (code ${outcome.code})`);
    console.log(`Reason: ${outcome.error?.message ?? 'unknown'}`);
  }
  process.exit(1);
}
