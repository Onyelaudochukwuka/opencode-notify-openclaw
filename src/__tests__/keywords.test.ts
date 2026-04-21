import { describe, it, expect } from "bun:test";
import { parseReply } from "../keywords.js";

describe("parseReply", () => {
  describe("Permission — once keywords", () => {
    it("should parse 'yes' as permission once", () => {
      expect(parseReply("yes")).toEqual({ type: "permission", response: "once" });
    });

    it("should parse 'y' as permission once", () => {
      expect(parseReply("y")).toEqual({ type: "permission", response: "once" });
    });

    it("should parse 'allow' as permission once", () => {
      expect(parseReply("allow")).toEqual({ type: "permission", response: "once" });
    });

    it("should parse 'YES' (uppercase) as permission once", () => {
      expect(parseReply("YES")).toEqual({ type: "permission", response: "once" });
    });

    it("should parse 'Yes' (mixed case) as permission once", () => {
      expect(parseReply("Yes")).toEqual({ type: "permission", response: "once" });
    });

    it("should parse 'yEs' (mixed case) as permission once", () => {
      expect(parseReply("yEs")).toEqual({ type: "permission", response: "once" });
    });
  });

  describe("Permission — always keywords", () => {
    it("should parse 'always' as permission always", () => {
      expect(parseReply("always")).toEqual({ type: "permission", response: "always" });
    });

    it("should parse 'ALWAYS' (uppercase) as permission always", () => {
      expect(parseReply("ALWAYS")).toEqual({ type: "permission", response: "always" });
    });
  });

  describe("Permission — reject keywords", () => {
    it("should parse 'no' as permission reject", () => {
      expect(parseReply("no")).toEqual({ type: "permission", response: "reject" });
    });

    it("should parse 'n' as permission reject", () => {
      expect(parseReply("n")).toEqual({ type: "permission", response: "reject" });
    });

    it("should parse 'deny' as permission reject", () => {
      expect(parseReply("deny")).toEqual({ type: "permission", response: "reject" });
    });

    it("should parse 'reject' as permission reject", () => {
      expect(parseReply("reject")).toEqual({ type: "permission", response: "reject" });
    });

    it("should parse 'NO' (uppercase) as permission reject", () => {
      expect(parseReply("NO")).toEqual({ type: "permission", response: "reject" });
    });

    it("should parse 'Deny' (mixed case) as permission reject", () => {
      expect(parseReply("Deny")).toEqual({ type: "permission", response: "reject" });
    });
  });

  describe("Free text (non-keywords)", () => {
    it("should parse 'please use the main branch' as freetext", () => {
      expect(parseReply("please use the main branch")).toEqual({
        type: "freetext",
        text: "please use the main branch",
      });
    });

    it("should parse 'yeah' as freetext (not a permission keyword)", () => {
      expect(parseReply("yeah")).toEqual({ type: "freetext", text: "yeah" });
    });

    it("should parse 'yep' as freetext", () => {
      expect(parseReply("yep")).toEqual({ type: "freetext", text: "yep" });
    });

    it("should parse 'ok' as freetext", () => {
      expect(parseReply("ok")).toEqual({ type: "freetext", text: "ok" });
    });

    it("should parse 'sure' as freetext", () => {
      expect(parseReply("sure")).toEqual({ type: "freetext", text: "sure" });
    });
  });

  describe("Edge cases", () => {
    it("should return null for empty string", () => {
      expect(parseReply("")).toBeNull();
    });

    it("should return null for whitespace only", () => {
      expect(parseReply("   ")).toBeNull();
    });
  });
});
