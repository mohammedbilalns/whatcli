import process from "node:process";
import pc from "picocolors";

export function printTable(
	headers: string[],
	rows: string[][],
	opts?: { border?: boolean; padding?: boolean },
) {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ansi escapes
	const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
	if (process.stdout.isTTY) {
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
		for (const row of rows) {
			console.log(row.join("\t"));
		}
	}
}

export function printInfo(msg: string) {
	if (process.stdout.isTTY) {
		console.log(pc.cyan(msg));
	} else {
		console.error(msg);
	}
}

export function printSuccess(msg: string) {
	if (process.stdout.isTTY) {
		console.log(pc.green(`✔ ${msg}`));
	} else {
		console.log(msg); // POSIX compliant success to stdout if possible, or stderr? Usually just stdout
	}
}

export function printError(msg: string) {
	if (process.stdout.isTTY) {
		console.error(pc.red(`✖ ${msg}`));
	} else {
		console.error(msg);
	}
}

export function printData(msg: string) {
	console.log(msg);
}
