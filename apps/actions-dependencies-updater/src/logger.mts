enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
}

export function setDebug() {
  LOG_LEVEL = LogLevel.DEBUG;
}

let LOG_LEVEL = LogLevel.INFO;

export function debug(...messages: Parameters<(typeof console)["debug"]>) {
  if (LOG_LEVEL === 0) console.debug("[DEBUG]", ...messages);
}

export function info(...messages: Parameters<(typeof console)["log"]>) {
  if (LOG_LEVEL <= 1) console.log("[INFO]", ...messages);
}

export function warn(...messages: Parameters<(typeof console)["log"]>) {
  if (LOG_LEVEL <= 2) console.log("[WARN]", ...messages);
}

export function error(...messages: Parameters<(typeof console)["error"]>) {
  if (LOG_LEVEL <= 3) console.error("[ERROR]", ...messages);
}

export function output(...messages: Parameters<(typeof console)["log"]>) {
  console.log(...messages);
}

export function section(section: string) {
  const repeats = Math.max(80 - section.length, 10);
  console.log("\n", "=".repeat(repeats), section, "=".repeat(repeats), "\n\n");
}
