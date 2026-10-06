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
    
    spinner.start('Syncing initial history... (this may take a moment)');
    const { MessageStore } = await import('../services/message-store.js');
    const { ContactStore } = await import('../services/contact-store.js');
    const { registerHistorySync } = await import('../whatsapp/history.js');
    
    const store = new MessageStore(db);
    const contactsStore = new ContactStore(db);
    let historyReceived = false;
    let totalMessages = 0;
    let totalChats = 0;
    let totalContacts = 0;

    sock.ev.on('contacts.upsert', (contacts_arr) => {
      for (const c of contacts_arr) {
        const name = c.name || c.notify || c.verifiedName;
        if (c.id && name) contactsStore.upsertName(c.id, name);
      }
    });

    await new Promise<void>((resolve) => {
      let timeout = setTimeout(resolve, 15000);
      
      registerHistorySync(sock, (batch) => {
        historyReceived = true;
        const stored = store.ingestHistory(batch);
        totalMessages += stored;
        totalChats += batch.chats.length;
        totalContacts += batch.contacts.length;
        spinner.text = `Syncing... ${totalMessages} messages, ${totalChats} chats, ${totalContacts} contacts`;
        
        clearTimeout(timeout);
        timeout = setTimeout(resolve, 3000);
      });
    });

    spinner.succeed(historyReceived ? `Sync complete: ${totalMessages} messages, ${totalChats} chats, ${totalContacts} contacts` : 'Connected (No history received immediately).');

    await sock.end(undefined);
    db.close();
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
