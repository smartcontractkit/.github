import { describe, it, expect } from "vitest";
import { getAbsentMessage, getApproveMessage } from "../messages";
import { CHANGESET_SIGNATURE } from "../github";

describe("messages", () => {
  describe("getAbsentMessage", () => {
    it("includes the commit SHA", () => {
      const msg = getAbsentMessage({
        commitSha: "abc123",
        addChangesetUrl: "https://example.com/new-file",
      });
      expect(msg).toContain("abc123");
    });

    it("includes the add changeset URL when provided", () => {
      const url =
        "https://github.com/org/repo/new/main?filename=.changeset/test.md";
      const msg = getAbsentMessage({
        commitSha: "abc123",
        addChangesetUrl: url,
      });
      expect(msg).toContain(url);
      expect(msg).toContain("maintainer who wants to add a changeset");
    });

    it("omits the maintainer link when addChangesetUrl is undefined", () => {
      const msg = getAbsentMessage({ commitSha: "abc123" });
      expect(msg).not.toContain("maintainer who wants to add a changeset");
    });

    it("includes the gocs reference", () => {
      const msg = getAbsentMessage({ commitSha: "abc123" });
      expect(msg).toContain("https://github.com/smartcontractkit/gocs");
    });

    it("includes the signature", () => {
      const msg = getAbsentMessage({ commitSha: "abc123" });
      expect(msg).toContain(CHANGESET_SIGNATURE);
    });
  });

  describe("getApproveMessage", () => {
    it("includes the commit SHA", () => {
      const msg = getApproveMessage("def456");
      expect(msg).toContain("def456");
    });

    it("includes the signature", () => {
      const msg = getApproveMessage("def456");
      expect(msg).toContain(CHANGESET_SIGNATURE);
    });
  });
});
