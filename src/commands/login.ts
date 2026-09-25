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


async function login(): Promise<void> {
  const config = loadConfig()
  const {state , saveCreds} = await useMultiFileAuthState(config.authDir)

  console.log('Connecting to whatsapp...')

  const {sock , outcome} = await connectAndWait(state,saveCreds, {
    timoutMs :120_000,
    onQr: (qr) =>{
      console.clear();
      console.log('Open Whatsapp -> Settings -> Linked Devices,then scan:\n')
      qrcode.generate(qr, {small: true})
    }
  })

  if(outcome.status === "connected"){
    await saveCreds() // flush the final creds to the disk 
    const me = state.creds.me
    const phone = me?.id ? phoneFromJid(me.id) : 'unknown'
    console.log('\n Connected')
    console.log(`Logged in as: ${phone}${me?.name ? `(${me.name})` : ''  }`)
    console.log(`Credentials: ${config.authDir}`)

    await sock.end(undefined)
    process.exit(0)
  }


  if(outcome.status === 'timeout'){
    console.log(`\n Timed out waiting for the scan, Run wacli login aain.`)
    process.exit(1)
  }

  if(outcome.code === DisconnectReason.loggedOut){
    console.log(`\n The saved session was logged out. Reset it and re-scan`)
    console.log(`rm -rf ${config.authDir}`)
    console.log(`pnpm dev login`)
  }else {
    console.log(`\n Connection closed (code ${outcome.code}): ${outcome.error?.message ?? 'unknow'}`)
  } 

  process.exit(1)
}
