export interface CheckWindow {
  from: string;
  to: string;
}

const DURATION_SEGMENT = /^(\d+)(h|m|s)/;

/**
 * Parses a duration string expressed as one or more integer h/m/s segments
 * (e.g. "10m", "1h30m", "45s") into a total number of seconds.
 */
export function parseDuration(duration: string): number {
  let remaining = duration;
  let total = 0;
  while (remaining.length > 0) {
    const match = DURATION_SEGMENT.exec(remaining);
    if (!match) {
      throw new Error(
        `'duration' must use h/m/s units (e.g. 10m, 1h30m), got '${duration}'`,
      );
    }
    const value = Number(match[1]);
    const unit = match[2];
    total += value * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
    remaining = remaining.slice(match[0].length);
  }
  if (total <= 0) {
    throw new Error(`'duration' must be positive, got '${duration}'`);
  }
  return total;
}

/**
 * Formats a Date as "YYYY-MM-DDTHH:MM:SSZ" in UTC, matching the original
 * `strftime` output so the format handed to `grafana-alertcheck` is unchanged.
 */
export function toRfc3339Utc(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
      date.getUTCDate(),
    )}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
      date.getUTCSeconds(),
    )}Z`
  );
}

/**
 * Adds a number of seconds to an RFC3339 timestamp and returns the result as
 * a UTC RFC3339 timestamp (no milliseconds).
 */
export function addSecondsToRfc3339(from: string, seconds: number): string {
  const date = new Date(from);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`'from' is not a valid RFC3339 timestamp, got '${from}'`);
  }
  const shifted = new Date(date.getTime() + seconds * 1000);
  return toRfc3339Utc(shifted);
}

/**
 * Validates the `from`/`to`/`duration` inputs for mode: check and resolves the
 * window's `to` value (`to` as given, or `from + duration`).
 */
export function resolveCheckWindow(
  from: string,
  to: string,
  duration: string,
): CheckWindow {
  if (from.trim() === "") {
    throw new Error(
      "'from' is required with mode: check, and must come from the deploy step's own completion output",
    );
  }
  if (to.trim() === "" && duration.trim() === "") {
    throw new Error(
      "exactly one of 'to' or 'duration' is required with mode: check",
    );
  }
  if (to.trim() !== "" && duration.trim() !== "") {
    throw new Error(
      "'to' and 'duration' are mutually exclusive — give exactly one",
    );
  }

  if (to.trim() !== "") {
    return { from, to };
  }

  const seconds = parseDuration(duration);
  return { from, to: addSecondsToRfc3339(from, seconds) };
}
