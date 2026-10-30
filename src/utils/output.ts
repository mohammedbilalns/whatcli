import process from "node:process";
import pc from "picocolors";

// biome-ignore lint/suspicious/noControlCharactersInRegex: ansi escapes
export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

export function cleanTsvField(val: unknown): string {
	const str = stripAnsi(String(val ?? ""));
	return str.replace(/[\r\n\t]+/g, " ");
}

export function printJson(data: unknown): void {
	if (process.stdout.isTTY) {
		process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
	} else {
		process.stdout.write(`${JSON.stringify(data)}\n`);
	}
}

export function printTable(
	headers: string[],
	rows: (string | number)[][],
	opts?: {
		border?: boolean;
		padding?: boolean;
		plain?: boolean;
		includeHeaderInTsv?: boolean;
	},
) {
	if (process.stdout.isTTY && !opts?.plain) {
		const widths = headers.map((h, i) =>
			Math.max(
				stripAnsi(h).length,
				...rows.map((r) => stripAnsi(String(r[i] ?? "")).length),
			),
		);
		const headerStr = headers
			.map((h, i) => {
				const len = stripAnsi(h).length;
				return h + " ".repeat(Math.max(0, widths[i] - len));
			})
			.join("   ");
		console.log(pc.bold(pc.gray(headerStr)));
		console.log(pc.dim("─".repeat(stripAnsi(headerStr).length)));
		for (const row of rows) {
			console.log(
				row
					.map((val, i) => {
						const s = String(val ?? "");
						const len = stripAnsi(s).length;
						return s + " ".repeat(Math.max(0, widths[i] - len));
					})
					.join("   "),
			);
			if (opts?.padding) console.log(); // blank line
		}
	} else {
		if (opts?.includeHeaderInTsv) {
			process.stdout.write(`${headers.map(cleanTsvField).join("\t")}\n`);
		}
		for (const row of rows) {
			process.stdout.write(`${row.map(cleanTsvField).join("\t")}\n`);
		}
	}
}

/** Diagnostic / informational messages always go to stderr so stdout remains clean for piping. */
export function printInfo(msg: string) {
	if (process.stderr.isTTY) {
		console.error(pc.cyan(msg));
	} else {
		console.error(msg);
	}
}

/** Success notifications go to stderr in interactive/pipe mode unless silenced. */
export function printSuccess(msg: string, quiet?: boolean) {
	if (quiet) return;
	if (process.stderr.isTTY) {
		console.error(pc.green(`✔ ${msg}`));
	} else {
		console.error(msg);
	}
}

/** Error messages always go to stderr. */
export function printError(msg: string) {
	if (process.stderr.isTTY) {
		console.error(pc.red(`✖ ${msg}`));
	} else {
		console.error(msg);
	}
}

/** Pure data written directly to stdout. */
export function printData(msg: string) {
	process.stdout.write(`${msg}\n`);
}
