import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { verifyCommit } from "../sigscanner";

describe("verifyCommit", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("passes commit and repository as query params and sets the secret header", async () => {
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await verifyCommit({
      url: "https://sigscanner.example.com/verify",
      apiKey: "secret-token",
      sha: "abcdef0123456789",
      repository: "smartcontractkit/chainlink",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toContain("commit=abcdef0123456789");
    expect(target).toContain("repository=smartcontractkit%2Fchainlink");
    expect(target).toMatch(/^https:\/\/sigscanner\.example\.com\/verify\?/);
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({
      "X-SIGSCANNER-SECRET": "secret-token",
    });
  });

  test("returns ok=true on 200 response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("verified", { status: 200 }));

    const result = await verifyCommit({
      url: "https://sig",
      apiKey: "k",
      sha: "s",
      repository: "r",
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.body).toBe("verified");
  });

  test("returns ok=false on 401 unauthorized", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("unauthorized", { status: 401 }),
    );

    const result = await verifyCommit({
      url: "https://sig",
      apiKey: "k",
      sha: "s",
      repository: "r",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.body).toBe("unauthorized");
  });

  test("returns ok=false on 500 server error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("server exploded", { status: 500 }),
    );

    const result = await verifyCommit({
      url: "https://sig",
      apiKey: "k",
      sha: "s",
      repository: "r",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  test("propagates fetch errors (network failure/timeout)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(
      verifyCommit({
        url: "https://sig",
        apiKey: "k",
        sha: "s",
        repository: "r",
      }),
    ).rejects.toThrow(/network down/);
  });
});
