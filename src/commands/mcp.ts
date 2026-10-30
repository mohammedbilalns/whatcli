import type { Command } from "commander";
import { type McpServerOptions, runMcpServer } from "../mcp/server.js";

export function registerMcpCommand(program: Command): void {
	program
		.command("mcp")
		.description(
			"Start WhatCLI Model Context Protocol (MCP) server over stdio for AI agents",
		)
		.option(
			"-r, --read-only",
			"disable all mutating tools (sending messages, replies, reactions)",
		)
		.action(async (opts: McpServerOptions) => {
			await runMcpServer(opts);
		});
}
