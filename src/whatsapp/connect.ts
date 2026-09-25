import { AuthenticationState, DisconnectReason } from "@whiskeysockets/baileys";
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

/**
 * Creates a WhatsApp connection and waits until the connection
 * succeeds, closes, or times out.
 */
export async function connectAndWait(
  auth : AuthenticationState,

  // Function to Persist updated whatsapp credentials. 
  saveCreds : () => Promise<void> | void ,

  // optional connection configuration. 
  options : ConnectOptions = {}
){

  const MAX_RESTARTS = 5

  for(let attempt = 0; ; attempt++){
    const sock = createWASocket(auth)

    // update the authentication credentials whenever the authentication state changes. 
    sock.ev.on('creds.update', saveCreds)

    // Promise that resolve when Baileys tells us what happened to the connection 
    const outcome = await new Promise<ConnectionOutCome>((resolve) => {

      // Listen for changes in the Whatsapp connection 
      sock.ev.on('connection.update', (update)=> {
        const { connection, lastDisconnect, qr} = update

        // If it requires QR authentication  pass the QR string 
        if(qr) options.onQr?.(qr)

        if(connection ===  'open') {
          resolve({status : 'connected'})

        }else if(connection === 'close'){

          // Disconnect boom error 
          const boom = lastDisconnect?.error as Boom | undefined

          resolve({
            status: 'closed',
            code : boom?.output?.statusCode ?? -1,
            error : boom ?? lastDisconnect?.error
          })
        }

      })

      setTimeout(() => resolve({status: 'timeout'}), options.timeoutMs ?? 60_000).unref()
    })

    if(outcome.status !== 'closed') return {sock, outcome}
    if(outcome.code === DisconnectReason.restartRequired && attempt < MAX_RESTARTS){
      continue
    }


    return {sock , outcome}
  }
}
