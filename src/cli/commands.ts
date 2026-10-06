import type { Command } from "commander";
import { registerChatsCommand } from "../commands/chats.js";
import { registerContactCommand } from "../commands/contact.js";
import { registerContactsCommand } from "../commands/contacts.js";
import { registerDaemonCommand } from "../commands/daemon.js";
import { registerDoctorCommand } from "../commands/doctor.js";
import { registerGroupCommand } from "../commands/group.js";
import { registerGroupsCommand } from "../commands/groups.js";
import { registerHistoryCommand } from "../commands/history.js";
import { registerLoginCommand } from "../commands/login.js";
import { registerLogoutCommand } from "../commands/logout.js";
import { registerMediaCommand } from "../commands/media.js";
import { registerReactCommand } from "../commands/react.js";
import { registerReplyCommand } from "../commands/reply.js";
import { registerRuleCommand } from "../commands/rule.js";
import { registerRulesCommand } from "../commands/rules.js";
import { registerSearchCommand } from "../commands/search.js";
import { registerSendCommand } from "../commands/send.js";
import { registerSendDocumentCommand } from "../commands/send-document.js";
import { registerSendImageCommand } from "../commands/send-image.js";
import { registerStatusCommand } from "../commands/status.js";

// commands registry
const commands = [
	registerLoginCommand,
	registerStatusCommand,
	registerDoctorCommand,
	registerDaemonCommand,
	registerLogoutCommand,
	registerChatsCommand,
	registerHistoryCommand,
	registerSendCommand,
	registerReactCommand,
	registerReplyCommand,
	registerMediaCommand,
	registerSendImageCommand,
	registerSearchCommand,
	registerSendDocumentCommand,
	registerGroupsCommand,
	registerGroupCommand,
	registerContactsCommand,
	registerContactCommand,
	registerRuleCommand,
	registerRulesCommand,
];
export function registerCommands(program: Command) {
	for (const registerCommand of commands) {
		registerCommand(program);
	}
}
