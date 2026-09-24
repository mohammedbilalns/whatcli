import pino from "pino"

export const logger = pino({
  level: process.env.WACLI_LOG_LEVEL ?? "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
    }
  }
})
