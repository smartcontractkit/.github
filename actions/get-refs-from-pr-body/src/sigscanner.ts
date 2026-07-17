export interface VerifyCommitOptions {
  url: string;
  apiKey: string;
  sha: string;
  repository: string;
  timeoutMs?: number;
}

export interface VerifyCommitResult {
  ok: boolean;
  status: number;
  body: string;
}

export async function verifyCommit(
  opts: VerifyCommitOptions,
): Promise<VerifyCommitResult> {
  const params = new URLSearchParams({
    commit: opts.sha,
    repository: opts.repository,
  });
  const target = `${opts.url}?${params.toString()}`;

  const response = await fetch(target, {
    method: "GET",
    headers: {
      "X-SIGSCANNER-SECRET": opts.apiKey,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
  });

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}
