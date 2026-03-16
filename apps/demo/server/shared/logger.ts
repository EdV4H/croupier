export type LogLevel = "info" | "warn" | "error";
export interface LogContext { [key: string]: unknown; }

export class Logger {
  constructor(private source: "local" | "workers") {}

  info(event: string, ctx?: LogContext) { this.log("info", event, ctx); }
  warn(event: string, ctx?: LogContext) { this.log("warn", event, ctx); }
  error(event: string, ctx?: LogContext) { this.log("error", event, ctx); }

  private log(level: LogLevel, event: string, ctx?: LogContext) {
    const entry = { ts: new Date().toISOString(), level, source: this.source, event, ...ctx };
    if (level === "error") console.error(JSON.stringify(entry));
    else if (level === "warn") console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  }
}

export function createLogger(source: "local" | "workers") {
  return new Logger(source);
}

export function truncatePayload(payload: unknown): string {
  try {
    return JSON.stringify(payload).slice(0, 200);
  } catch {
    return "[unserializable]";
  }
}
