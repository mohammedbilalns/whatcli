#!/usr/bin/env node

import { Command} from "commander";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerLoginCommand } from "../commands/login.js";
import { registerStatusCommand } from "../commands/status.js";
import { registerDoctorCommand } from "../commands/doctor.js";



const pkgPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "package.json"
);

const {version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as {version : string}

// Create the Commander program 
const program = new Command();

program
  .name('wacli')
  .description('Whatsapp in your terminal')
  .version(version)

// Register the application's CLI commands.
registerLoginCommand(program)
registerStatusCommand(program)
registerDoctorCommand(program)


await program.parseAsync(process.argv)
