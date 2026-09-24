import { Command } from "commander";

export function registerLoginCommand(program : Command): void {

  program
    .command('login')
    .description('Scan a QR code to connect to Whatsapp')
    .action(() => console.log('Not implemented yet '))
}
