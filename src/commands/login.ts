import { Command } from "commander";
import { loadConfig } from "../utils/config.js";
import qrcode from "qrcode-terminal"
import { DisconnectReason } from "@whiskeysockets/baileys";
import { openDatabase } from "../db/database.js";
import { useSqliteAuthState } from "../whatsapp/auth.js";
import { connectAndWait } from "../whatsapp/connect.js";
import { phoneFromJid } from "../whatsapp/jid.js";
import ora from 'ora';
import { printInfo, printSuccess, printError } from '../utils/output.js';


export function registerLoginCommand(program : Command): void {

  program
    .command('login')
    .description('Connect to Whatsapp by scanning QR Code')
    .action(() => login()) 
}

async function login(): Promise<void> {
  const config = loadConfig()
  const db = openDatabase(config);
  const {state , saveCreds} = await useSqliteAuthState(db)

  const spinner = ora('Connecting to WhatsApp...').start();
  
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
      if (key === 'q' || key === 'Q' || key === '\u0003') {
        spinner.stop();
        console.log('\nExiting...');
        process.exit(0);
      }
    });
  }

  const {sock , outcome} = await connectAndWait(state,saveCreds, {
    timeoutMs :120_000,
    onQr: (qr) =>{
      spinner.stop();
      console.clear();
      printInfo('Open WhatsApp -> Settings -> Linked Devices, then scan:\n');
      qrcode.generate(qr, {small: true});
      spinner.start('Waiting for scan... (Press "q" to cancel)');
    }
  })

  if(outcome.status === "connected"){
    spinner.succeed('Connected');
    await saveCreds(); 
    const me = state.creds.me;
    const phone = me?.id ? phoneFromJid(me.id) : 'unknown';
    printSuccess(`Logged in as: ${phone} ${me?.name ? `(${me.name})` : ''}`);
    
    await sock.end(undefined);
    process.exit(0);
  }

  if(outcome.status === 'timeout'){
    spinner.fail('Timed out waiting for scan. Run "wacli login" again.');
    process.exit(1);
  }

  if(outcome.code === DisconnectReason.loggedOut){
    spinner.warn('Saved session is invalid — wiping it and starting a fresh login.');
    db.prepare('DELETE FROM auth_state').run();
    db.close();
    return login();
  } else {
    spinner.fail(`Connection closed (code ${outcome.code}): ${outcome.error?.message ?? 'unknown'}`);
  } 

  process.exit(1);
}
