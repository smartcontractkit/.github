/**
 * Fetches job log tails via signed URL + Range requests.
 */

import type { OctokitClient } from '../types';

const DEFAULT_TAIL_BYTES = 50_000;

export async function getLogTail(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  jobId: number,
  bytes: number = DEFAULT_TAIL_BYTES,
): Promise<string> {
  const logsUrl = await getLogsUrl(octokit, owner, repo, jobId);

  const headResponse = await fetch(logsUrl, { method: 'HEAD' });
  if (!headResponse.ok) {
    throw new Error(`HEAD request failed: ${headResponse.status} ${headResponse.statusText}`);
  }

  const contentLength = parseInt(headResponse.headers.get('content-length') ?? '0', 10);
  if (contentLength === 0) {
    return '(empty log)';
  }

  const start = Math.max(0, contentLength - bytes);
  const rangeResponse = await fetch(logsUrl, {
    headers: { Range: `bytes=${start}-` },
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

async function getLogsUrl(octokit: OctokitClient, owner: string, repo: string, jobId: number): Promise<string> {
  const manualFetch = (url: string | URL | Request, init?: RequestInit) => fetch(url, { ...init, redirect: 'manual' });

  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs', {
      owner,
      repo,
      job_id: jobId,
      request: { fetch: manualFetch },
    });

    const location = (response.headers as Record<string, string>)?.location;
    if (location) return location;
    throw new Error('Expected 302 redirect but got 200 with no Location header');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 302) {
      const resp = (error as { response?: { headers?: Record<string, string> } }).response;
      const location = resp?.headers?.location;
      if (location) return location;
    }
    throw new Error(
      `Failed to get logs URL for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export { DEFAULT_TAIL_BYTES };
