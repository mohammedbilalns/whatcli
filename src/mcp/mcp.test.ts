import { describe, expect, it } from "vitest";
import { createMcpServer } from "./server.js";

describe("MCP Server", () => {
	it("registers read and action tools by default", () => {
		const server = createMcpServer();
		// @ts-expect-error accessing private registered tools for verification
		const tools = server._registeredTools;
		expect(tools).toHaveProperty("list_chats");
		expect(tools).toHaveProperty("get_chat_history");
		expect(tools).toHaveProperty("search_messages");
		expect(tools).toHaveProperty("list_contacts");
		expect(tools).toHaveProperty("get_connection_status");
		expect(tools).toHaveProperty("send_message");
		expect(tools).toHaveProperty("send_reply");
		expect(tools).toHaveProperty("send_reaction");
		expect(tools).toHaveProperty("lookup_phone");
	});

	it("omits action/mutating tools when readOnly is true", () => {
		const server = createMcpServer({ readOnly: true });
		// @ts-expect-error accessing private registered tools for verification
		const tools = server._registeredTools;
		expect(tools).toHaveProperty("list_chats");
		expect(tools).toHaveProperty("get_chat_history");
		expect(tools).toHaveProperty("search_messages");
		expect(tools).toHaveProperty("list_contacts");
		expect(tools).toHaveProperty("get_connection_status");

		expect(tools).not.toHaveProperty("send_message");
		expect(tools).not.toHaveProperty("send_reply");
		expect(tools).not.toHaveProperty("send_reaction");
		expect(tools).not.toHaveProperty("lookup_phone");
	});

	it("registers MCP resources for chats and contacts", () => {
		const server = createMcpServer();
		// @ts-expect-error accessing private registered resources
		const resources = server._registeredResources;
		expect(resources).toHaveProperty("whatsapp://chats");
		expect(resources).toHaveProperty("whatsapp://contacts");
	});

	it("list_chats tool executes and returns valid JSON", async () => {
		const server = createMcpServer();
		// @ts-expect-error accessing tool handler
		const tool = server._registeredTools.list_chats;
		const result = await tool.handler({ limit: 10, type: "all" });
		expect(result).toHaveProperty("content");
		expect(Array.isArray(result.content)).toBe(true);
		const parsed = JSON.parse(result.content[0].text);
		expect(Array.isArray(parsed)).toBe(true);
	});

	it("list_contacts tool executes and returns valid JSON", async () => {
		const server = createMcpServer();
		// @ts-expect-error accessing tool handler
		const tool = server._registeredTools.list_contacts;
		const result = await tool.handler({});
		expect(result).toHaveProperty("content");
		const parsed = JSON.parse(result.content[0].text);
		expect(Array.isArray(parsed)).toBe(true);
	});

	it("get_connection_status tool executes and returns status", async () => {
		const server = createMcpServer();
		// @ts-expect-error accessing tool handler
		const tool = server._registeredTools.get_connection_status;
		const result = await tool.handler({});
		expect(result).toHaveProperty("content");
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toHaveProperty("connected");
		expect(parsed).toHaveProperty("status");
	});
});
