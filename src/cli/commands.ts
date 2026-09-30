import { Command } from "commander";
import { registerLoginCommand } from "../commands/login.js";
import { registerStatusCommand } from "../commands/status.js";
import { registerDoctorCommand } from "../commands/doctor.js";
import { registerWatchCommand } from "../commands/watch.js";
import { registerLogoutCommand } from "../commands/logout.js";
import { registerChatsCommand } from "../commands/chats.js";
import { registerHistoryCommand } from "../commands/history.js";
import { registerSearchCommand } from "../commands/search.js";
import { registerSendCommand } from "../commands/send.js";

export function registerCommands(program : Command){
  registerLoginCommand(program)
  registerStatusCommand(program)
  registerDoctorCommand(program)
  registerWatchCommand(program)
  registerLogoutCommand(program)
  registerChatsCommand(program)
  registerHistoryCommand(program)
  registerSearchCommand(program)
  registerSendCommand(program)
}
