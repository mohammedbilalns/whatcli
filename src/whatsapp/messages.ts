import { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { phoneFromJid } from "./jid.js";

export function registerMessagePrinter(sock :WASocket): void {
  sock.ev.on("messages.upsert", ({messages, type} ) => {

    if( type !== 'notify') return 


    for( const msg of messages){
      printMessage(msg)
      if(process.env.WACLI_RAW){
        console.log(JSON.stringify(msg,null,2));
      }
    }
  })
}


function printMessage(msg : WAMessage): void {
  console.log("RawMessage ", JSON.stringify(msg))
  console.log(`[${ts(msg)}] ${senderLabel(msg)}${chatLabel(msg)} > ${describeContent(msg)}`)
}

function ts(msg : WAMessage): string {
  const t = msg.messageTimestamp
  return t ? new Date(Number(t) * 1000).toLocaleString([], {hour: '2-digit', minute:'2-digit'}) : '??:??'
}

type KeyWithAlt = WAMessage['key'] & { remoteJidAlt?: string; participantAlt?: string };

function phoneLabel(msg: WAMessage): string {
  const key = msg.key as KeyWithAlt;
  const alt = key.participantAlt || key.remoteJidAlt; // group sender / 1:1 chat
  if (alt) return phoneFromJid(alt);                  // a @s.whatsapp.net JID → "+91…"
  return phoneFromJid(msg.key.participant || msg.key.remoteJid || '');
}

function senderLabel(msg : WAMessage): string {
  if(msg.key.fromMe) return "You"
  if(msg.pushName) return msg.pushName
  return phoneLabel(msg)
}

function chatLabel(msg : WAMessage): string {
  const jid = msg.key.remoteJid
  if(!jid?.endsWith('@g.us')) return ''
  return `[group ...${(jid.split('@')[0] ?? '').slice(-4)}]`
}

function contentOf(msg: WAMessage){
  let m = msg.message
  if(m?.ephemeralMessage) m = m.ephemeralMessage.message
  if(m?.viewOnceMessage) m = m.viewOnceMessage.message
  return m 
}
function describeContent(msg: WAMessage): string {
  const m = contentOf(msg);
  if (!m) return '(empty)';
  if (isProtocolOnly(m)) return '[sender-key sync — protocol message, no user content]';

  if (m.conversation) return m.conversation; // plain text
  if (m.extendedTextMessage) {               // text with extras
    const text = m.extendedTextMessage.text ?? '';
    const isReply = !!m.extendedTextMessage.contextInfo?.quotedMessage;
    return isReply ? `${text}   ⤷ (reply)` : text;
  }
  if (m.imageMessage) return `[image${m.imageMessage.caption ? `: ${m.imageMessage.caption}` : ''}]`;
  if (m.videoMessage) return `[video${m.videoMessage.caption ? `: ${m.videoMessage.caption}` : ''}]`;
  if (m.audioMessage) return m.audioMessage.ptt ? '[voice note]' : '[audio file]';
  if (m.documentMessage) return `[document: ${m.documentMessage.fileName ?? 'unnamed'}]`;
  if (m.stickerMessage) return '[sticker]';
  if (m.reactionMessage) return `[reacted ${m.reactionMessage.text ?? '?'}]`;
  if (m.protocolMessage) return `[protocol message (type ${m.protocolMessage.type})]`;
  return `[unrecognized: ${Object.keys(m).join(', ')}]`; 
}

function isProtocolOnly(m: NonNullable<WAMessage['message']>): boolean {
  const keys = Object.keys(m);
  return (
    keys.length > 0 &&
      keys.every((k) => k === 'senderKeyDistributionMessage' || k === 'messageContextInfo')
  );
}
