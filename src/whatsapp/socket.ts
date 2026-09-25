import makeWASocket, { AuthenticationState, Browsers } from "@whiskeysockets/baileys";
import { baileysLogger } from "../utils/logger.js";

/**
 * Creates a Baileys WhatsApp Web socket.
 *
 * The socket manages the connection with WhatsApp,
 * authentication state, encryption, and incoming/outgoing messages.
 */
export function createWASocket( auth : AuthenticationState) {
  return makeWASocket({
    logger: baileysLogger,
    // Previously saved authentication/session credentials.
    // This allows the client to reconnect without scanning QR again.
    auth,

    // Don't automatically show the WhatsApp account as "online".
    markOnlineOnConnect: false ,

    // Identify the client as Ubuntu + Chrome to WhatsApp.
    browser: Browsers.ubuntu('Chrome')
  })
}
