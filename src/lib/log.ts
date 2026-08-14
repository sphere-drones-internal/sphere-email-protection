// Structured JSON logging (T2 control). One line per event, machine-parseable, so
// the platform's log pipeline can index/alert on level, event, and context rather
// than scraping free-text. Errors are serialised to { name, message } — never a
// raw stack blob, and never anything secret.

type Level = "info" | "warn" | "error";

function serialise(_key: string, value: unknown) {
  if (value instanceof Error) return { name: value.name, message: value.message };
  return value;
}

function emit(level: Level, event: string, ctx?: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...ctx }, serialise);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, ctx?: Record<string, unknown>) => emit("info", event, ctx),
  warn: (event: string, ctx?: Record<string, unknown>) => emit("warn", event, ctx),
  error: (event: string, ctx?: Record<string, unknown>) => emit("error", event, ctx),
};
