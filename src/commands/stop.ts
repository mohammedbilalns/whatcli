import { program } from "commander";
import { loadConfig } from "../utils/config.js";
import { IpcClient } from "../ipc/client.js";

program.command('stop').description('Stop a running wacli daemon')
  .action(async () => {
    const config = loadConfig();
    const ipc = new IpcClient(config.ipcPath);
    if (!(await ipc.alive())) { console.log('No daemon running.'); process.exit(1); }
    await ipc.request('stop');
    console.log('✅ Daemon stopped.');
  });
