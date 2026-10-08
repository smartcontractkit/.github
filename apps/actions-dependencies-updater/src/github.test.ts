import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createServer, type Server } from "node:http";

import { Octokit } from "octokit";
import type { RunContext } from "./index.mjs";
import * as caches from "./caches.mjs";
import * as github from "./github.mjs";

const GH_URL = "https://api.github.com";
const TOKEN = "ghp_octokit-parity-token";

interface TagEntry {
  ref: string;
  object: { sha: string; type: string; url: string };
}

const matchingRefs: Record<string, TagEntry[]> = {
  "lw/repo": [
    {
      ref: "refs/tags/v1.2.3",
      object: {
        sha: "sha-lw-1",
        type: "commit",
        url: `${GH_URL}/repos/lw/repo/git/commits/sha-lw-1`,
      },
    },
  ],
  "ann/repo": [
    {
      ref: "refs/tags/v2.0.0",
      object: {
        sha: "sha-tag-obj",
        type: "tag",
        url: `${GH_URL}/repos/ann/repo/git/tags/sha-tag-obj`,
      },
    },
  ],
  "mo/.github": [
    {
      ref: "refs/tags/foo@1.0.1",
      object: {
        sha: "sha-mo-1",
        type: "commit",
        url: `${GH_URL}/repos/mo/.github/git/commits/sha-mo-1`,
      },
    },
  ],
  "none/repo": [],
};

const tagObjects: Record<string, TagEntry> = {
  "ann/repo/sha-tag-obj": {
    ref: "refs/tags/v2.0.0",
    object: {
      sha: "sha-ann-commit",
      type: "commit",
      url: `${GH_URL}/repos/ann/repo/git/commits/sha-ann-commit`,
    },
  },
};

type ContentEntry =
  { type: "file"; encoding: "base64"; content: string } | { type: string }[];

const contents: Record<string, ContentEntry> = {
  "content/repo/actions/foo/action.yml": {
    type: "file",
    encoding: "base64",
    content: Buffer.from("name: from-yml").toString("base64"),
  },
  "content/repo/actions/dir/action.yml": [{ type: "dir" }],
  "onlyyaml/repo/actions/foo/action.yaml": {
    type: "file",
    encoding: "base64",
    content: Buffer.from("name: from-yaml").toString("base64"),
  },
};

const requests: { method: string; url: string; auth?: string }[] = [];

function normalizeUrl(raw: string): string {
  const path = decodeURIComponent(raw.split("?")[0]);
  return "/" + path.replace(/^\/+/, "");
}

function route(rawUrl: string): { status: number; body: unknown } {
  const path = normalizeUrl(rawUrl);

  let match = path.match(
    /^\/repos\/([^/]+)\/([^/]+)\/git\/matching-refs\/tags$/,
  );
  if (match) {
    return {
      status: 200,
      body: matchingRefs[`${match[1]}/${match[2]}`] ?? [],
    };
  }

  match = path.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/tags\/(.+)$/);
  if (match) {
    const tagObject = tagObjects[`${match[1]}/${match[2]}/${match[3]}`];
    if (tagObject) return { status: 200, body: tagObject };
  }

  match = path.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
  if (match) {
    const content = contents[`${match[1]}/${match[2]}/${match[3]}`];
    if (content) return { status: 200, body: content };
  }

  return { status: 404, body: { message: "Not Found" } };
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push({
      method: req.method ?? "",
      url: req.url ?? "",
      auth: req.headers.authorization,
    });
    const { status, body } = route(req.url ?? "");
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start test server");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requests.length = 0;
});

function makeCtx(): RunContext {
  return {
    repoDir: "",
    performChecks: false,
    performUpdates: false,
    git: { branch: false, commit: false, reset: false },
    octokit: new Octokit({ auth: TOKEN, baseUrl }),
    debug: { workflows: 0, actions: 0, contentRequests: 0, tagRequests: 0 },
    caches: caches.initialize(true),
  };
}

describe(github.getVersionFromSHA.name, () => {
  test("resolves a lightweight tag from a commit sha", async () => {
    const ctx = makeCtx();

    const version = await github.getVersionFromSHA(
      ctx,
      "lw",
      "repo",
      "",
      "sha-lw-1",
    );
    expect(version).toBe("v1.2.3");
  });

  test("resolves an annotated tag through its tag object", async () => {
    const ctx = makeCtx();

    const version = await github.getVersionFromSHA(
      ctx,
      "ann",
      "repo",
      "",
      "sha-ann-commit",
    );
    expect(version).toBe("v2.0.0");

    expect(requests.map((r) => normalizeUrl(r.url))).toEqual([
      "/repos/ann/repo/git/matching-refs/tags",
      "/repos/ann/repo/git/tags/sha-tag-obj",
    ]);
  });

  test("falls back to v0.0.0 when no tag matches the ref", async () => {
    const ctx = makeCtx();

    const version = await github.getVersionFromSHA(
      ctx,
      "none",
      "repo",
      "",
      "sha-unknown",
    );
    expect(version).toBe("v0.0.0");
  });

  test("resolves the monorepo-prefixed tag for .github actions", async () => {
    const ctx = makeCtx();

    const version = await github.getVersionFromSHA(
      ctx,
      "mo",
      ".github",
      "actions/foo",
      "sha-mo-1",
    );
    expect(version).toBe("foo@1.0.1");
  });

  test("serves repeat lookups from the sha-to-version cache", async () => {
    const ctx = makeCtx();

    await github.getVersionFromSHA(ctx, "lw", "repo", "", "sha-lw-1");
    const requestCount = requests.length;
    expect(requestCount).toBe(1);

    await github.getVersionFromSHA(ctx, "lw", "repo", "", "sha-lw-1");
    expect(requests.length).toBe(requestCount);
  });
});

describe(github.getLatestVersion.name, () => {
  test("returns the sha and latest version from the cache", () => {
    const ctx = makeCtx();
    ctx.caches.shaToVersion.set("lw/repo", {
      "sha-lw-0": ["v1.0.0"],
      "sha-lw-1": ["v1.0.0", "v1.2.3"],
    });

    expect(github.getLatestVersion(ctx, "lw", "repo", "")).toEqual({
      sha: "sha-lw-1",
      version: "v1.2.3",
    });
  });
});

describe(github.getFile.name, () => {
  test("decodes base64 file content from the contents endpoint", async () => {
    const ctx = makeCtx();

    const file = await github.getFile(
      ctx,
      "content",
      "repo",
      "actions/foo/action.yml",
      "main",
    );
    expect(file).toBe("name: from-yml");
  });

  test("returns undefined on a 404", async () => {
    const ctx = makeCtx();

    const file = await github.getFile(
      ctx,
      "content",
      "repo",
      "actions/missing/action.yml",
      "main",
    );
    expect(file).toBeUndefined();
  });

  test("returns undefined for a directory response without content", async () => {
    const ctx = makeCtx();

    const file = await github.getFile(
      ctx,
      "content",
      "repo",
      "actions/dir/action.yml",
      "main",
    );
    expect(file).toBeUndefined();
  });
});

describe(github.getActionFile.name, () => {
  test("prefers action.yml", async () => {
    const ctx = makeCtx();

    const file = await github.getActionFile(
      ctx,
      "content",
      "repo",
      "actions/foo",
      "main",
    );
    expect(file).toBe("name: from-yml");
    expect(requests.map((r) => normalizeUrl(r.url))).toEqual([
      "/repos/content/repo/contents/actions/foo/action.yml",
    ]);
  });

  test("falls back to action.yaml when action.yml is missing", async () => {
    const ctx = makeCtx();

    const file = await github.getActionFile(
      ctx,
      "onlyyaml",
      "repo",
      "actions/foo",
      "main",
    );
    expect(file).toBe("name: from-yaml");
    expect(requests.map((r) => normalizeUrl(r.url))).toEqual([
      "/repos/onlyyaml/repo/contents/actions/foo/action.yml",
      "/repos/onlyyaml/repo/contents/actions/foo/action.yaml",
    ]);
  });
});

describe("octokit request parity", () => {
  test("sends the token on every request", async () => {
    const ctx = makeCtx();

    await github.getVersionFromSHA(ctx, "ann", "repo", "", "sha-ann-commit");
    await github.getFile(
      ctx,
      "content",
      "repo",
      "actions/foo/action.yml",
      "main",
    );

    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.auth).toContain(TOKEN);
    }
  });
});
