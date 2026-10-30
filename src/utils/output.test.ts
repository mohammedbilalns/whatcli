import { describe, expect, it, vi } from "vitest";
import {
	cleanTsvField,
	printData,
	printError,
	printInfo,
	printJson,
	printSuccess,
	printTable,
	stripAnsi,
} from "./output.js";

describe("output utilities", () => {
	it("strips ANSI color escapes", () => {
		const colored = "\x1b[31mError\x1b[0m: \x1b[32mOK\x1b[0m";
		expect(stripAnsi(colored)).toBe("Error: OK");
	});

	it("sanitizes tabs, newlines, and carriage returns for clean TSV fields", () => {
		const raw = "Line 1\nLine 2\r\nCol1\tCol2";
		expect(cleanTsvField(raw)).toBe("Line 1 Line 2 Col1 Col2");
	});

	it("handles null and undefined safely", () => {
		expect(cleanTsvField(null)).toBe("");
		expect(cleanTsvField(undefined)).toBe("");
	});

	it("printJson writes serialized JSON to stdout", () => {
		const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		printJson({ key: "value", number: 42 });
		expect(spy).toHaveBeenCalled();
		const output = spy.mock.calls[0]?.[0] as string;
		expect(JSON.parse(output.trim())).toEqual({ key: "value", number: 42 });
		spy.mockRestore();
	});

	it("printTable writes clean TSV to stdout in non-TTY mode", () => {
		const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		printTable(
			["ID", "NAME", "DETAILS"],
			[
				["1", "Alice", "Developer\nFrontend"],
				["2", "Bob\tSmith", "Designer"],
			],
			{ plain: true },
		);

		expect(spy).toHaveBeenCalled();
		const calls = spy.mock.calls.map((c) => c[0] as string);
		// Row 1 should have newlines sanitized
		expect(calls[0]).toBe("1\tAlice\tDeveloper Frontend\n");
		// Row 2 should have tabs sanitized
		expect(calls[1]).toBe("2\tBob Smith\tDesigner\n");
		spy.mockRestore();
	});

	it("printTable can include TSV header row when requested", () => {
		const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		printTable(["COL1", "COL2"], [["A", "B"]], {
			plain: true,
			includeHeaderInTsv: true,
		});

		const calls = spy.mock.calls.map((c) => c[0] as string);
		expect(calls[0]).toBe("COL1\tCOL2\n");
		expect(calls[1]).toBe("A\tB\n");
		spy.mockRestore();
	});

	it("printError and printInfo write to stderr", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		printError("Critical failure");
		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Critical failure"),
		);

		printInfo("Informational note");
		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Informational note"),
		);
		spy.mockRestore();
	});

	it("printSuccess writes to stderr unless silenced by quiet option", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		printSuccess("Operation succeeded", false);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Operation succeeded"),
		);

		printSuccess("Silent success", true);
		// Should still be called only once
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	it("printData writes directly to stdout", () => {
		const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		printData("raw data line");
		expect(spy).toHaveBeenCalledWith("raw data line\n");
		spy.mockRestore();
	});
});
