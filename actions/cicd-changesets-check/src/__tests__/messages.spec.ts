import { describe, it, expect } from "vitest";
import { getAbsentMessage, getApproveMessage } from "../messages";
import { CHANGESET_SIGNATURE } from "../github";

describe("messages", () => {
  describe("getAbsentMessage", () => {
    it("includes the commit SHA", () => {
      const msg = getAbsentMessage("abc123", "https://example.com/new-file");
      expect(msg).toContain("abc123");
    });

    it("includes the add changeset URL", () => {
      const url =
        "https://github.com/org/repo/new/main?filename=.changeset/test.md";
      const msg = getAbsentMessage("abc123", url);
      expect(msg).toContain(url);
    });

    it("includes the signature", () => {
      const msg = getAbsentMessage("abc123", "https://example.com");
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
