/**
 * Medic configuration helpers and non-configurable constants.
 */

import { DEFAULT_MERGE_CONFLICT_CONFIG } from "./workflow-config";

export const ATTEMPT_LABEL_PREFIX = "medic-attempts:";
export const LOCK_LABEL = "medic-in-progress";

export const COMMENT_MARKER = "<!-- medic-comment -->";
export const RETRY_COMMENT_MARKER = "<!-- medic-retry-comment -->";

export const MEDIC_LOGO_URL =
  "https://github.com/user-attachments/assets/0202a091-560b-4d53-ac8c-1c075712bb4b";
export const MEDIC_LOGO_SIZE = 144;

export const PRICING = {
  inputPerMTok: 3.0,
  outputPerMTok: 15.0,
  cacheCreationPerMTok: 3.75,
  cacheReadPerMTok: 0.3,
};

export function isAuthorAllowed(
  login: string,
  allowedAuthors: string[] = DEFAULT_MERGE_CONFLICT_CONFIG.allowed_authors,
): boolean {
  return allowedAuthors
    .map((a) => a.toLowerCase())
    .includes(login.toLowerCase());
}

export function hasSkipLabel(
  labels: string[],
  skipLabels: string[] = DEFAULT_MERGE_CONFLICT_CONFIG.skip_labels,
): boolean {
  const normalizedLabels = labels.map((l) => l.toLowerCase());
  return skipLabels.some((skip) =>
    normalizedLabels.some((l) => l.includes(skip.toLowerCase())),
  );
}

export function hasLockLabel(labels: string[]): boolean {
  return labels.map((l) => l.toLowerCase()).includes(LOCK_LABEL.toLowerCase());
}

export function getAttemptCount(labels: string[]): number {
  const label = labels.find((l) => l.startsWith(ATTEMPT_LABEL_PREFIX));
  if (!label) return 0;
  const count = parseInt(label.split(":")[1], 10);
  return isNaN(count) ? 0 : count;
}

export function hasExceededMaxAttempts(
  labels: string[],
  maxAttempts: number = DEFAULT_MERGE_CONFLICT_CONFIG.max_attempts,
): boolean {
  return getAttemptCount(labels) >= maxAttempts;
}

export function isRecentlyActive(
  pushedDate: string | undefined,
  thresholdHours: number = DEFAULT_MERGE_CONFLICT_CONFIG.activity_threshold_hours,
): boolean {
  if (!pushedDate) return false;
  const cutoff = Date.now() - thresholdHours * 60 * 60 * 1000;
  return new Date(pushedDate).getTime() > cutoff;
}
