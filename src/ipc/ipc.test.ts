import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { IpcServer } from "./server.js";
import { IpcClient } from "./client.js";

describe("ipc", () => {
	it("round-trips a request and surfaces handler errors", async () => {
		const sockPath = path.join(tmpdir(), `wacli-test-${process.pid}.sock`);
		const server = new IpcServer(sockPath, async (method, params) => {
			if (method === "echo") return { echoed: params.text };
			throw new Error("nope");
		});
		await server.start();
		const client = new IpcClient(sockPath);

		expect(await client.alive()).toBe(true);
		expect(await client.request("echo", { text: "hi" })).toEqual({
			echoed: "hi",
		});
		await expect(client.request("bad")).rejects.toThrow("nope");

		await server.stop();
		expect(await client.alive()).toBe(false);
	});
});
