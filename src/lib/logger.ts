type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, module: string, message: string, data?: unknown) {
  const entry = `[${level.toUpperCase()}] [${module}] ${message}`;
  if (data !== undefined) {
    console[level](entry, data);
  } else {
    console[level](entry);
  }
}

export const logger = {
  info: (module: string, message: string, data?: unknown) =>
    log("info", module, message, data),
  warn: (module: string, message: string, data?: unknown) =>
    log("warn", module, message, data),
  error: (module: string, message: string, data?: unknown) =>
    log("error", module, message, data),
};
