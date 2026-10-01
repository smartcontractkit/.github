import { describe, expect, it } from "vitest";

import { mapArch, mapOs, resolveAsset } from "../release";

describe("mapOs", () => {
  it("maps Linux", () => {
    expect(mapOs("Linux")).toBe("linux");
  });

  it("maps macOS", () => {
    expect(mapOs("macOS")).toBe("darwin");
  });

  it("rejects unknown OS", () => {
    expect(() => mapOs("Windows")).toThrow("unsupported runner OS");
  });
});

describe("mapArch", () => {
  it("maps X64", () => {
    expect(mapArch("X64")).toBe("amd64");
  });

  it("maps ARM64", () => {
    expect(mapArch("ARM64")).toBe("arm64");
  });

  it("rejects unknown arch", () => {
    expect(() => mapArch("X86")).toThrow("unsupported runner arch");
  });
});

describe("resolveAsset", () => {
  it("builds the release URL for linux amd64", () => {
    const asset = resolveAsset("v0.1.0", "Linux", "X64");
    expect(asset).toEqual({
      os: "linux",
      arch: "amd64",
      url: "https://github.com/smartcontractkit/chainlink-testing-framework/releases/download/grafana-alertcheck%2Fv0.1.0/grafana-alertcheck-v0.1.0-linux-amd64.tar.gz",
    });
  });

  it("builds the release URL for darwin arm64", () => {
    const asset = resolveAsset("v0.1.0", "macOS", "ARM64");
    expect(asset.url).toContain("darwin-arm64.tar.gz");
  });
});
