import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type Config, loadConfig } from "../utils/config.js";
import { printError } from "../utils/output.js";
import { registerResources } from "./resources.js";
import { registerActionTools } from "./tools/action-tools.js";
import { registerReadTools } from "./tools/read-tools.js";

const pkgPath = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"package.json",
);

function getVersion(): string {
	try {
		return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string })
			.version;
	} catch {
		return "1.0.0";
	}
}

export interface McpServerOptions {
	readOnly?: boolean;
	config?: Config;
}

export function createMcpServer(opts: McpServerOptions = {}): McpServer {
	const config = opts.config ?? loadConfig();
	const version = getVersion();

	const server = new McpServer({
		name: "whatcli",
		version,
	});

	// Register read-only tools
	registerReadTools(server, config);

	// Register mutating/action tools unless --read-only
	if (!opts.readOnly) {
		registerActionTools(server, config);
	}

	// Register MCP resources
	registerResources(server, config);

	return server;
}

export async function runMcpServer(opts: McpServerOptions = {}): Promise<void> {
	const server = createMcpServer(opts);
	const version = getVersion();
	const transport = new StdioServerTransport();

	printError(
		`WhatCLI MCP server v${version} started on stdio ${opts.readOnly ? "(read-only mode)" : ""}`,
	);

	await server.connect(transport);
}
