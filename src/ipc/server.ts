import net from "node:net";
import { existsSync, unlinkSync, chmodSync } from "node:fs";
import type { IpcRequest } from "./protocol.js";

export type IpcHandler = (
	method: string,
	params: Record<string, unknown>,
) => Promise<unknown>;

export class IpcServer {
	private server?: net.Server;

	constructor(
		private readonly path: string,
		private readonly handler: IpcHandler,
		private readonly log: (line: string) => void = () => {},
	) {}

	async start(): Promise<void> {
		// Stale-socket dance: a crashed daemon leaves the file behind.
		if (existsSync(this.path)) {
			const alive = await new IpcClient(this.path).alive();
			if (alive)
				throw new Error(`a daemon is already listening at ${this.path}`);
			unlinkSync(this.path);
		}

		await new Promise<void>((resolve, reject) => {
			this.server = net.createServer((conn) => this.#onConn(conn));
			this.server.once("error", reject);
			this.server.listen(this.path, () => resolve());
		});
		chmodSync(this.path, 0o600);
		this.log(`ipc listening on ${this.path}`);
	}

	async stop(): Promise<void> {
		await new Promise<void>((resolve) => this.server?.close(() => resolve()));
		if (existsSync(this.path)) unlinkSync(this.path);
	}

	#onConn(conn: net.Socket): void {
		let buf = "";
		conn.on("data", (chunk) => {
			buf += chunk;
			const nl = buf.indexOf("\n");
			if (nl < 0) return;
			const line = buf.slice(0, nl);
			buf = "";

			let req: IpcRequest;
			try {
				req = JSON.parse(line) as IpcRequest;
			} catch {
				conn.end();
				return;
			}

			void this.handler(req.method, req.params ?? {})
				.then((result) =>
					conn.write(JSON.stringify({ id: req.id, ok: true, result }) + "\n"),
				)
				.catch((err) =>
					conn.write(
						JSON.stringify({
							id: req.id,
							ok: false,
							error: String(err?.message ?? err),
						}) + "\n",
					),
				);
		});
		conn.on("error", () => {});
	}
}

import { IpcClient } from "./client.js";
