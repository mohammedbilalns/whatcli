import path from "node:path"
import { fileURLToPath } from "node:url";

export interface Config {
  dataDir: string;
  authDir: string;
  mediaDir: string;
  dbPath : string;
  logLevel : string;
}

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
)

export function loadConfig(): Config {
  const dataDir = process.env.WACLI_DATA_DIR ??  path.join(projectRoot, "data")

  return {
    dataDir,
    authDir: path.join(dataDir, "auth"),
    mediaDir: path.join(dataDir, "media"),
    dbPath: path.join(dataDir, "wacli.db"),
    logLevel : process.env.WACLI_LOG_LEVEL ?? 'info'
  }
}
