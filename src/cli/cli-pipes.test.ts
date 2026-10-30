import { execSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLI_PATH = path.resolve(__dirname, "../../src/cli/main.ts");
const TSX_BIN = path.resolve(__dirname, "../../node_modules/.bin/tsx");
const RUN_CLI = `"${TSX_BIN}" "${CLI_PATH}"`;

describe("CLI Unix Composability & Piping Integration", () => {
	it("wacli doctor --json outputs valid JSON to stdout", () => {
		const output = execSync(`${RUN_CLI} doctor --json`, {
			encoding: "utf8",
		});
		const parsed = JSON.parse(output);
		expect(parsed).toHaveProperty("passed");
		expect(parsed).toHaveProperty("sqlite");
	});

	it("wacli doctor -q exits with 0 and produces no stdout", () => {
		const output = execSync(`${RUN_CLI} doctor -q`, {
			encoding: "utf8",
		});
		expect(output).toBe("");
	});

	it("wacli status --json outputs valid JSON", () => {
		let output = "";
		try {
			output = execSync(`${RUN_CLI} status --json`, {
				encoding: "utf8",
			});
		} catch (err: unknown) {
			const execErr = err as { stdout: string; status: number };
			output = execErr.stdout;
		}
		const parsed = JSON.parse(output);
		expect(parsed).toHaveProperty("status");
		expect(parsed).toHaveProperty("connected");
	});

	it("wacli status -q exits with zero stdout output", () => {
		let output = "";
		try {
			output = execSync(`${RUN_CLI} status -q`, {
				encoding: "utf8",
			});
		} catch (err: unknown) {
			const execErr = err as { stdout: string; status: number };
			output = execErr.stdout;
			expect(execErr.status).toBe(1);
		}
		expect(output).toBe("");
	});

	it("wacli chats --json outputs valid JSON array", () => {
		const output = execSync(`${RUN_CLI} chats --json`, {
			encoding: "utf8",
		});
		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
	});

	it("wacli chats piped to head does not crash with EPIPE", () => {
		// When head closes the pipe early, exit code must remain 0
		const output = execSync(`${RUN_CLI} chats | head -n 3`, {
			encoding: "utf8",
		});
		const lines = output.trim().split("\n");
		expect(lines.length).toBeLessThanOrEqual(3);
	});

	it("wacli chats output is parseable by cut/awk tab delimiters", () => {
		const output = execSync(`${RUN_CLI} chats | cut -f 1 | head -n 2`, {
			encoding: "utf8",
		});
		if (output.trim()) {
			const ids = output.trim().split("\n");
			for (const id of ids) {
				expect(id).toMatch(/^\d+$/);
			}
		}
	});

	it("wacli send writes errors to stderr and leaves stdout clean", () => {
		try {
			execSync(`${RUN_CLI} send NonExistentUserXYZ "hello"`, {
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			expect.unreachable("should have failed with exit code 1");
		} catch (err: unknown) {
			const execErr = err as { stdout: string; stderr: string; status: number };
			expect(execErr.status).toBe(1);
			expect(execErr.stdout).toBe("");
			expect(execErr.stderr).toMatch(/No chat matching|Not logged in/);
		}
	});

	it("wacli send reads message from stdin when piped", () => {
		try {
			execSync(`echo "test message" | ${RUN_CLI} send NonExistentUserXYZ`, {
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			expect.unreachable("should have failed with exit code 1");
		} catch (err: unknown) {
			const execErr = err as { stdout: string; stderr: string; status: number };
			expect(execErr.status).toBe(1);
			expect(execErr.stderr).not.toContain("missing required argument");
			expect(execErr.stderr).toMatch(/No chat matching|Not logged in/);
		}
	});

	it("wacli search writes no-match message to stderr and exits with 1", () => {
		try {
			execSync(`${RUN_CLI} search nonexistentqueryxyz123456`, {
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			expect.unreachable("should have exited with 1 for no match");
		} catch (err: unknown) {
			const execErr = err as { stdout: string; stderr: string; status: number };
			expect(execErr.status).toBe(1);
			expect(execErr.stdout).toBe("");
			expect(execErr.stderr).toContain("No stored messages matching");
		}
	});
});
