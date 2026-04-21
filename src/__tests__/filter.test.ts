import { describe, it, expect } from "bun:test";
import { shouldNotify } from "../filter.js";

describe("shouldNotify", () => {
  describe("SHOULD match (return true) - questions and pause detection", () => {
    it("should match: ends with question mark", () => {
      expect(shouldNotify("Which file should I edit?")).toBe(true);
    });

    it("should match: question about proceeding", () => {
      expect(shouldNotify("Should I proceed with the refactor?")).toBe(true);
    });

    it("should match: explicit prompt with options", () => {
      const text = "I have two options:\n1. Delete the file\n2. Rename it\nPlease choose one.";
      expect(shouldNotify(text)).toBe(true);
    });

    it("should match: would you like continuation", () => {
      expect(shouldNotify("Would you like me to continue?")).toBe(true);
    });

    it("should match: implicit input request", () => {
      expect(shouldNotify("Let me know which approach you prefer.")).toBe(true);
    });

    it("should match: explicit input request", () => {
      expect(shouldNotify("I need your input on this decision.")).toBe(true);
    });

    it("should match: question with multiple options", () => {
      expect(shouldNotify("Do you want me to run the tests first, or deploy directly?")).toBe(true);
    });

    it("should match: confirmation request", () => {
      expect(shouldNotify("Please confirm before I proceed.")).toBe(true);
    });

    it("should match: short question", () => {
      expect(shouldNotify("What do you think?")).toBe(true);
    });

    it("should match: multi-sentence ending with question", () => {
      expect(shouldNotify("I'm not sure how to handle this. Should I use Option A or B?")).toBe(true);
    });
  });

  describe("SHOULD NOT match (return false) - statements and reports", () => {
    it("should not match: completion statement", () => {
      expect(shouldNotify("I've completed the refactoring. Here are the changes I made:")).toBe(false);
    });

    it("should not match: explanation", () => {
      expect(shouldNotify("The function returns the user's email address.")).toBe(false);
    });

    it("should not match: in-progress status", () => {
      expect(shouldNotify("Running tests now...")).toBe(false);
    });

    it("should not match: code block with ternary operator", () => {
      const text = "Here's the code:\n```typescript\nconst x = condition ? a : b;\n```";
      expect(shouldNotify(text)).toBe(false);
    });

    it("should not match: done statement", () => {
      expect(shouldNotify("Done! All files have been updated.")).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      expect(shouldNotify("")).toBe(false);
    });

    it("should handle whitespace only", () => {
      expect(shouldNotify("   \n\t  ")).toBe(false);
    });

    it("should handle multiple code blocks", () => {
      const text = "```js\nconst x = a ? b : c;\n```\nSome text\n```python\ny = z ? w : v\n```";
      expect(shouldNotify(text)).toBe(false);
    });

    it("should handle question mark inside code block", () => {
      const text = "```\nWhat is this?\n```\nDone.";
      expect(shouldNotify(text)).toBe(false);
    });

    it("should be case-insensitive for keywords", () => {
      expect(shouldNotify("PLEASE CHOOSE ONE.")).toBe(true);
    });

    it("should handle mixed case question words", () => {
      expect(shouldNotify("WhAt Do YoU tHiNk?")).toBe(true);
    });

    it("should match question word at sentence start after period", () => {
      expect(shouldNotify("I've done the work. What do you think?")).toBe(true);
    });

    it("should match question word at sentence start after exclamation", () => {
      expect(shouldNotify("Great! Should I deploy now?")).toBe(true);
    });

    it("should not match question word in middle of sentence", () => {
      expect(shouldNotify("The what and why of this approach is clear.")).toBe(false);
    });

    it("should handle multiple sentences with question at end", () => {
      const text = "I've analyzed the code. The performance is good. Should I proceed?";
      expect(shouldNotify(text)).toBe(true);
    });
  });
});
