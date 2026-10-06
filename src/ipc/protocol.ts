export interface IpcRequest {
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export type IpcResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };
