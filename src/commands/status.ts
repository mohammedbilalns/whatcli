import { Command } from "commander";

export function registerStatusCommand(program: Command ): void {
  program
    .command('status')
    .description('Check the current status ')
    .action(() => console.log('Not implemented yet '))
}
