import net from 'node:net';
import type { IpcResponse } from './protocol.js';

export class IpcClient {
  constructor(private readonly path: string) {}

  alive(): Promise<boolean> {
    return new Promise((resolve) => {
      const s = net.connect(this.path);
      const done = (v: boolean) => { s.destroy(); resolve(v); };
      s.once('connect', () => done(true));
      s.once('error', () => done(false));
      setTimeout(() => done(false), 1_000).unref();
    });
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const s = net.connect(this.path, () => {
        s.write(JSON.stringify({ id: 1, method, params }) + '\n');
      });
      let buf = '';
      s.on('data', (chunk) => {
        buf += chunk;
        const nl = buf.indexOf('\n');
        if (nl < 0) return;
        const res = JSON.parse(buf.slice(0, nl)) as IpcResponse;
        s.end();
        if (res.ok) resolve(res.result);
          else reject(new Error(res.error));
      });
      s.on('error', reject); // e.g. daemon died mid-request
    });
  }
}
