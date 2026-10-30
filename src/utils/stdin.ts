import process from "node:process";

/**
 * Returns true if input is being piped to stdin (i.e. not an interactive terminal).
 */
export function isStdinPiped(): boolean {
	return !process.stdin.isTTY;
}

/**
 * Reads all text from process.stdin.
 * Returns empty string if stdin is a TTY and not piped.
 */
export async function readStdinText(): Promise<string> {
	if (process.stdin.isTTY) {
		return "";
	}
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8").trimEnd();
}

/**
 * Reads all raw binary data from process.stdin.
 */
export async function readStdinBuffer(): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}
