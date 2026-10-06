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
import { registerReactCommand } from "../commands/react.js";
import { registerReplyCommand } from "../commands/reply.js";
import { registerMediaCommand } from "../commands/send-document.js";
import { registerSendImageCommand } from "../commands/send-image.js";

// commands registry 
const commands = [
  registerLoginCommand, 
  registerStatusCommand,
  registerDoctorCommand,
  registerWatchCommand,
  registerLogoutCommand,
  registerChatsCommand,
  registerHistoryCommand, 
  registerSendCommand,
  registerReactCommand,
  registerReplyCommand,
  registerMediaCommand,
  registerSendImageCommand,
  registerSearchCommand
]
export function registerCommands(program : Command){

  for (const registerCommand of commands) {
    registerCommand(program)
  }

}
