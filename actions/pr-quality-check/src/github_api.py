"""GitHub API interaction functions."""

import time
import requests
from typing import Any, Dict, List

GITHUB_API = "https://api.github.com"
MARKDOWN_FINGERPRINT = "<!-- pr-quality-check -->"


def gh_req(method: str, path: str, token: str, params=None, data=None, json_body=None, headers=None):
    """Make authenticated GitHub API request with simple retries/backoff."""
    url = f"{GITHUB_API}{path}"
    h = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if headers:
        h.update(headers)

    last_err = None
    for attempt in range(3):
        try:
            r = requests.request(method, url, params=params, data=data, json=json_body, headers=h, timeout=60)
            if r.status_code == 429:
                wait_s = int(r.headers.get("Retry-After", "1"))
                time.sleep(min(wait_s, 10))
                last_err = RuntimeError(f"GitHub rate limited: {r.text}")
                continue
            if 500 <= r.status_code < 600:
                last_err = RuntimeError(f"GitHub server error {r.status_code}: {r.text}")
                time.sleep(1 + attempt)
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"GitHub API {method} {path} failed: {r.status_code} {r.text}")
            return r
        except requests.RequestException as e:
            last_err = e
            time.sleep(1 + attempt)
    if last_err:
        raise last_err
    raise RuntimeError("Unknown GitHub API error")


def gh_paginate(token: str, path: str, params=None):
    """Paginate through GitHub API results."""
    page = 1
    params = dict(params or {})
    params["per_page"] = 100
    while True:
        params["page"] = page
        r = gh_req("GET", path, token, params=params)
        items = r.json()
        if not items:
            break
        for it in items:
            yield it
        page += 1


def get_pr(token: str, owner: str, repo: str, pr_number: int) -> Dict[str, Any]:
    """Get PR details from GitHub API."""
    return gh_req("GET", f"/repos/{owner}/{repo}/pulls/{pr_number}", token).json()


def list_pr_files(token: str, owner: str, repo: str, pr_number: int) -> List[Dict[str, Any]]:
    """Get list of changed files in PR."""
    files: List[Dict[str, Any]] = []
    for it in gh_paginate(token, f"/repos/{owner}/{repo}/pulls/{pr_number}/files"):
        files.append(it)
    return files


def upsert_comment(token: str, owner: str, repo: str, pr_number: int, body: str):
    """Create or update PR comment with quality check results."""
    comments = list(gh_paginate(token, f"/repos/{owner}/{repo}/issues/{pr_number}/comments"))
    target = None
    for c in comments:
        b = (c.get("body") or "")
        if MARKDOWN_FINGERPRINT in b:
            target = c
            break
    if target:
        gh_req("PATCH", f"/repos/{owner}/{repo}/issues/comments/{target['id']}", token, json_body={"body": body})
    else:
        gh_req("POST", f"/repos/{owner}/{repo}/issues/{pr_number}/comments", token, json_body={"body": body})
