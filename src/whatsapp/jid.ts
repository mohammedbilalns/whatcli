
export function phoneFromJid(jid: string): string {

  // Extract the user/phone part from the WhatsApp JID.
  const user = jid.split('@')[0]?.split(':')[0];


  // Add "+" to make it a phone number format.
  // If extraction fails, return the original JID
  return user ? `+${user}` : jid
}
