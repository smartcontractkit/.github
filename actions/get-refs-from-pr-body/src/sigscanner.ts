import * as core from "@actions/core";

export interface VerifyCommitOptions {
  url: string;
  apiKey: string;
  sha: string;
  repository: string;
  timeoutMs?: number;
}

export interface VerifyCommitResult {
  verified: boolean;
  status: number;
  body: string;
}

export async function verifyCommit(
  opts: VerifyCommitOptions,
): Promise<VerifyCommitResult> {
  const params = new URLSearchParams({
    commit: opts.sha,
    repository: opts.repository,
    disable_gpg: "true",
  });
  const target = `${opts.url}?${params.toString()}`;

  core.debug(
    `SigScanner request: GET ${target} (repository=${opts.repository}, commit=${opts.sha})`,
  );

  const response = await fetch(target, {
    method: "GET",
    headers: {
      "X-SIGSCANNER-SECRET": opts.apiKey,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
  });

  const body = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  core.debug(
    `SigScanner response: status=${response.status} ok=${response.ok}`,
  );
  core.debug(`SigScanner response body: ${body}`);

  const verified = response.ok && parseVerified(body);

  return {
    verified,
    status: response.status,
    body,
  };
}

function parseVerified(body: string): boolean {
  try {
    const parsed = JSON.parse(body);
    return parsed?.verified === true;
  } catch {
    return false;
  }
}
