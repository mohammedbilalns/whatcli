import { Command } from "commander";
import { loadConfig } from "../utils/config.js";
import qrcode from "qrcode-terminal"
import { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { connectAndWait } from "../whatsapp/connect.js";
import { phoneFromJid } from "../whatsapp/jid.js";

export function registerLoginCommand(program : Command): void {

  program
    .command('login')
    .description('Connect to Whatsapp by scanning QR Code')
    .action(() => login()) 
}

/**
 * Handles the WhatsApp login process.
 */
async function login(): Promise<void> {
  const config = loadConfig()

  /*
   * Load the WhatsApp authentication state from disk.
   *
   * `state` contains the credentials and cryptographic
   * keys required by Baileys to authenticate.
   *
   * `saveCreds` is a function that persists updated
   * credentials back to the auth directory.
   *
   * If this is the first login, the directory may not
   * contain an authenticated session yet.
   */
  const {state , saveCreds} = await useMultiFileAuthState(config.authDir)

  console.log('Connecting to whatsapp...')

  /*
   * Create the WhatsApp connection and wait for one of:
   *
   *   - successful connection
   *   - connection failure
   *   - timeout
   *
   * `onQr` is called whenever Baileys generates a QR code.
   */
  const {sock , outcome} = await connectAndWait(state,saveCreds, {
    timeoutMs :120_000,
    onQr: (qr) =>{
      console.clear();
      console.log('Open Whatsapp -> Settings -> Linked Devices,then scan:\n')
      // Converts the QR string into a terminal-friendly QR code.
      qrcode.generate(qr, {small: true})
    }
  })

  /*
   * ─────────────────────────────────────────────
   * CONNECTION SUCCESSFUL
   * ─────────────────────────────────────────────
   */
  if(outcome.status === "connected"){
    /*
     * Save the final authentication credentials.
     *
     * Baileys may have updated the credentials during
     * the connection process, so this ensures the latest
     * state is persisted to disk.
     */
    await saveCreds() 
    const me = state.creds.me
    const phone = me?.id ? phoneFromJid(me.id) : 'unknown'
    console.log('\n Connected')
    console.log(`Logged in as: ${phone}${me?.name ? `(${me.name})` : ''  }`)
    console.log(`Credentials: ${config.authDir}`)

    /*

     * Close the connection before exiting the CLI.
     */
    await sock.end(undefined)
    process.exit(0)
  }


  if(outcome.status === 'timeout'){
    console.log(`\n Timed out waiting for the scan, Run wacli login aain.`)
    process.exit(1)
  }

  /*
   * ─────────────────────────────────────────────
   * CONNECTION CLOSED / FAILED
   * ─────────────────────────────────────────────
   * Check whether WhatsApp explicitly logged out
   * this session.
   *
   * In that case, the saved authentication state
   * can no longer be used.
   */
  if(outcome.code === DisconnectReason.loggedOut){
    console.log(`\n The saved session was logged out. Reset it and re-scan`)
    console.log(`rm -rf ${config.authDir}`)
    console.log(`pnpm dev login`)
  }else {
    console.log(`\n Connection closed (code ${outcome.code}): ${outcome.error?.message ?? 'unknow'}`)
  } 

  process.exit(1)
}
