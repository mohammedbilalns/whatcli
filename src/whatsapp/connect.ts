import { AuthenticationState, DisconnectReason, WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { createWASocket } from "./socket.js";

/**
 * Possible results while waiting for the WhatsApp connection.
 *
 * connected → Connection was successfully established.
 *
 * closed → WhatsApp closed the connection or the connection failed.
 *          `code` contains the WhatsApp/HTTP-style status code when available.
 *
 * timeout → Connection did not succeed within the allowed time.
 */
export type ConnectionOutCome = 
| {status : "connected"}
| {status : 'closed'; code: number, error?: Error } 
| {status: 'timeout'}


export interface ConnectOptions {
  // Called whenever Baileys provides a QR code for authentication.
  onQr?: (qr: string) => void
  timeoutMs?: number
}



/** Extract close reason. */
function extractClose(lastDisconnect: {error?: unknown} | undefined): {code: number, error?: Error}{
  const boom = lastDisconnect?.error as Boom | undefined
  return {
    code : boom?.output?.statusCode ?? -1,
    error : boom ?? (lastDisconnect?.error as Error | undefined)
  }
}


/** Create a socket and wire save creds. */
export function createSocket(
  auth: AuthenticationState,
  saveCreds: () => Promise<void> | void 
): WASocket{
  const sock = createWASocket(auth)
  sock.ev.on('creds.update', saveCreds)
  return sock 
}


/** Wait for the connection update event until timeout . */
export function awaitOpenOrClose(sock : WASocket, options: ConnectOptions) : Promise<ConnectionOutCome>{
  return new Promise((resolve) => {
    // listen for connectino updates 
    sock.ev.on('connection.update', (update) => {
      const {connection, lastDisconnect, qr} = update
      // if qr code recieved call the handler to show it in terminal
      if(qr) options.onQr?.(qr)
      if(connection === "open"){
        resolve({status: "connected"})
      }else if(connection === 'close'){
        resolve({status: 'closed',...extractClose(lastDisconnect)})
      }
    })

    setTimeout(() => resolve({ status: 'timeout' }), options.timeoutMs ?? 60_000).unref();
  })
}


/**
 * Wait for the NEXT connection close event on an already-open socket.
 */
export function nextClose(sock: WASocket): Promise<{code: number; error?: Error}>{
  return new Promise((resolve) => {
    sock.ev.on('connection.update',(update) => {
      if(update.connection === "close") resolve(extractClose(update.lastDisconnect))
    } )
  })
}

export async function connectAndWait(
  auth: AuthenticationState,
  saveCreds: () => Promise<void> | void,
  options: ConnectOptions = {},
): Promise<{ sock: WASocket; outcome: ConnectionOutCome }> {
  const MAX_RESTARTS = 5;
  for (let attempt = 0; ; attempt++) {
    const sock = createSocket(auth, saveCreds);
    const outcome = await awaitOpenOrClose(sock, options);
    if (outcome.status !== 'closed') return { sock, outcome };
    if (outcome.code !== DisconnectReason.loggedOut && attempt < MAX_RESTARTS) continue;
    return { sock, outcome };
  }
}
