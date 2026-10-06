#!/usr/bin/env node

import { Command} from "commander";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerCommands } from "./commands.js";

const pkgPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "package.json"
);

const {version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as {version : string}

const program = new Command();

program
  .name('wacli')
  .description('Whatsapp in your terminal')
  .version(version)

registerCommands(program)


await program.parseAsync(process.argv)
