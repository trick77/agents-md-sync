import pc from "picocolors";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: Level = (process.env.LOG_LEVEL as Level) ?? "info";

export function setLevel(level: Level): void {
  currentLevel = level;
}

const PREFIX: Record<Level, string> = {
  debug: pc.gray("[debug]"),
  info: pc.cyan("[info]"),
  warn: pc.yellow("[warn]"),
  error: pc.red("[error]"),
};

function log(level: Level, ...args: unknown[]): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return;
  const stream = level === "error" || level === "warn" ? console.error : console.log;
  stream(PREFIX[level], ...args);
}

export const logger = {
  debug: (...a: unknown[]) => log("debug", ...a),
  info: (...a: unknown[]) => log("info", ...a),
  warn: (...a: unknown[]) => log("warn", ...a),
  error: (...a: unknown[]) => log("error", ...a),
};
