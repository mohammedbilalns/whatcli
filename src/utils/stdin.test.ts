import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { isStdinPiped, readStdinBuffer, readStdinText } from "./stdin.js";

describe("stdin utilities", () => {
	const originalStdin = process.stdin;

	afterEach(() => {
		Object.defineProperty(process, "stdin", {
			value: originalStdin,
			configurable: true,
		});
	});

	it("detects piped stdin when isTTY is false or undefined", () => {
		const mockStream = new Readable({ read() {} });
		// @ts-expect-error test mock
		mockStream.isTTY = false;
		Object.defineProperty(process, "stdin", {
			value: mockStream,
			configurable: true,
		});

		expect(isStdinPiped()).toBe(true);
	});

	it("reads piped text from stdin and trims trailing whitespace", async () => {
		const mockStream = Readable.from(["Hello from piped ", "stdin\n\n"]);
		// @ts-expect-error test mock
		mockStream.isTTY = false;
		Object.defineProperty(process, "stdin", {
			value: mockStream,
			configurable: true,
		});

		const result = await readStdinText();
		expect(result).toBe("Hello from piped stdin");
	});

	it("reads raw binary buffer from stdin", async () => {
		const rawBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
		const mockStream = Readable.from([rawBytes]);
		// @ts-expect-error test mock
		mockStream.isTTY = false;
		Object.defineProperty(process, "stdin", {
			value: mockStream,
			configurable: true,
		});

		const result = await readStdinBuffer();
		expect(Buffer.compare(result, rawBytes)).toBe(0);
	});
});
