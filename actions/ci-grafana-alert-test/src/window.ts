export interface CheckWindow {
  from: string;
  to: string;
}

export interface LiveWindow {
  from?: string;
  to: string;
}

// GitHub-hosted runners are killed after 6 hours, so an observation window
// longer than this can never complete. The 30-minute headroom covers the
// surrounding steps and the CLI's grace/drain time.
export const MAX_OBSERVATION_WINDOW_SECONDS = 5 * 3600 + 30 * 60;
export const MAX_OBSERVATION_WINDOW = "5h30m";

const DURATION_SEGMENT = /^(\d+)(h|m|s)/;

/**
 * Parses the `observation_window` input, expressed as one or more integer h/m/s
 * segments (e.g. "10m", "1h30m", "45s"), into a total number of seconds.
 */
export function parseObservationWindow(observationWindow: string): number {
  let remaining = observationWindow;
  let total = 0;
  while (remaining.length > 0) {
    const match = DURATION_SEGMENT.exec(remaining);
    if (!match) {
      throw new Error(
        `'observation_window' must use h/m/s units (e.g. 10m, 1h30m), got '${observationWindow}'`,
      );
    }
    const value = Number(match[1]);
    const unit = match[2];
    total += value * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
    remaining = remaining.slice(match[0].length);
  }
  if (total <= 0) {
    throw new Error(
      `'observation_window' must be positive, got '${observationWindow}'`,
    );
  }
  return total;
}

function assertWithinMaxObservationWindow(seconds: number): void {
  if (seconds > MAX_OBSERVATION_WINDOW_SECONDS) {
    throw new Error(
      `the observation window is longer than the maximum supported ${MAX_OBSERVATION_WINDOW}: ` +
        "GitHub Actions runners can run for at most 6 hours",
    );
  }
}

// An invalid timestamp is the CLI's to reject — it parses --from/--to itself —
// so only a parseable pair can be judged here.
function assertWindowWithinLimit(fromMs: number, toMs: number): void {
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return;
  }
  assertWithinMaxObservationWindow((toMs - fromMs) / 1000);
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

function assertSingleToOrObservationWindow(
  to: string,
  observationWindow: string,
  mode: string,
): void {
  if (to.trim() === "" && observationWindow.trim() === "") {
    throw new Error(
      `exactly one of 'to' or 'observation_window' is required with mode: ${mode}`,
    );
  }
  if (to.trim() !== "" && observationWindow.trim() !== "") {
    throw new Error(
      "'to' and 'observation_window' are mutually exclusive — give exactly one",
    );
  }
}

/**
 * Resolves the `from`/`to`/`observation_window` inputs for mode: check into the
 * window's `to` value (`to` as given, or `from + observation_window`). Whether
 * `from` is present is the CLI's to enforce, except where the arithmetic here
 * needs it.
 */
export function resolveCheckWindow(
  from: string,
  to: string,
  observationWindow: string,
): CheckWindow {
  assertSingleToOrObservationWindow(to, observationWindow, "check");

  if (to.trim() !== "") {
    assertWindowWithinLimit(Date.parse(from), Date.parse(to));
    return { from, to };
  }

  const seconds = parseObservationWindow(observationWindow);
  assertWithinMaxObservationWindow(seconds);
  return { from, to: addSecondsToRfc3339(from, seconds) };
}

// Live must not lose the base's fractional seconds: truncating 10:00:00.900
// before adding 1s yields a 100 ms window. Go accepts fractional seconds.
function toRfc3339PreciseUtc(date: Date): string {
  return date.toISOString().replace(/\.000Z$/, "Z");
}

/**
 * Resolves the `from`/`to`/`observation_window` inputs for mode: live
 * (single-step). `from` is optional there — the CLI starts observing at its
 * first poll and names the earlier gap a blind spot. `observation_window` is
 * measured from the start of the live run, not from `from`. Whether `to` is in
 * the future is the CLI's to enforce.
 */
export function resolveLiveWindow(
  from: string,
  to: string,
  observationWindow: string,
  now: Date = new Date(),
): LiveWindow {
  assertSingleToOrObservationWindow(to, observationWindow, "live");

  let resolvedTo: string;
  if (to.trim() !== "") {
    resolvedTo = to;
  } else {
    const seconds = parseObservationWindow(observationWindow);
    assertWithinMaxObservationWindow(seconds);
    resolvedTo = toRfc3339PreciseUtc(new Date(now.getTime() + seconds * 1000));
  }

  const startMs = from.trim() !== "" ? Date.parse(from) : now.getTime();
  assertWindowWithinLimit(startMs, Date.parse(resolvedTo));

  return from.trim() !== "" ? { from, to: resolvedTo } : { to: resolvedTo };
}
