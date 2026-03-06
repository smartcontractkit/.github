/**
 * Log service for fetching job log tails via HTTP Range requests.
 *
 * GitHub's job logs API returns a 302 redirect to a signed blob storage URL.
 * We intercept the redirect to get the URL, then use Range headers to fetch
 * only the tail of the log without downloading the entire file.
 *
 * Note: @octokit/request v8.x silently ignores `redirect: 'manual'` on the
 * request options (removed in #599, re-added in v9.1.0). The workaround is
 * to pass a custom `fetch` that applies the redirect policy itself.
 * See: https://github.com/octokit/request.js/issues/635
 */

import type { OctokitClient } from '../types.js';

const DEFAULT_TAIL_BYTES = 50_000;

/**
 * Get the tail of a job's logs using Range-based fetching.
 * Returns the last `bytes` of the log as a string.
 */
export async function getLogTail(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  jobId: number,
  bytes: number = DEFAULT_TAIL_BYTES
): Promise<string> {
  const logsUrl = await getLogsUrl(octokit, owner, repo, jobId);

  // HEAD to get Content-Length so we can compute the Range offset
  const headResponse = await fetch(logsUrl, { method: 'HEAD' });
  if (!headResponse.ok) {
    throw new Error(`HEAD request failed: ${headResponse.status} ${headResponse.statusText}`);
  }

  const contentLength = parseInt(headResponse.headers.get('content-length') ?? '0', 10);
  if (contentLength === 0) {
    return '(empty log)';
  }

  // Azure Blob Storage requires explicit start offset, not suffix-range
  const start = Math.max(0, contentLength - bytes);
  const rangeResponse = await fetch(logsUrl, {
    headers: { 'Range': `bytes=${start}-` }
  });

  if (!rangeResponse.ok && rangeResponse.status !== 206) {
    throw new Error(`Range request failed: ${rangeResponse.status} ${rangeResponse.statusText}`);
  }

  const text = await rangeResponse.text();

  if (start > 0) {
    const firstNewline = text.indexOf('\n');
    if (firstNewline !== -1) {
      return text.substring(firstNewline + 1);
    }
  }

  return text;
}

/**
 * Get the signed download URL for a job's logs by intercepting the 302 redirect.
 *
 * We inject a custom fetch with redirect:'manual' because @octokit/request v8.x
 * does not pass request.redirect through to the underlying fetch call. Octokit
 * treats the 302 as an error (non-2xx), so we catch it and extract the Location.
 */
async function getLogsUrl(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  jobId: number
): Promise<string> {
  const manualFetch = (url: string | URL | Request, init?: RequestInit) =>
    fetch(url, { ...init, redirect: 'manual' });

  try {
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs',
      {
        owner,
        repo,
        job_id: jobId,
        request: { fetch: manualFetch }
      }
    );

    // Shouldn't reach here (API always returns 302), but handle gracefully
    const location = (response.headers as Record<string, string>)?.location;
    if (location) return location;
    throw new Error('Expected 302 redirect but got 200 with no Location header');
  } catch (error: unknown) {
    // Octokit throws RequestError on non-2xx; extract Location from the 302
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 302) {
      const resp = (error as { response?: { headers?: Record<string, string> } }).response;
      const location = resp?.headers?.location;
      if (location) return location;
    }
    throw new Error(
      `Failed to get logs URL for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export { DEFAULT_TAIL_BYTES };
