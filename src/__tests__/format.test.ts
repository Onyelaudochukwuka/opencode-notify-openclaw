import { describe, it, expect } from "bun:test";
import { formatNotification } from "../format.js";
import type { EventType } from "../types.js";

describe("formatNotification", () => {
  it("should format session.idle with project ID and waiting message", () => {
    const result = formatNotification("session.idle", { sessionID: "sess-123" }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("myproject");
    expect(result?.toLowerCase()).toContain("waiting");
  });

  it("should format session.error with project ID and error message", () => {
    const result = formatNotification("session.error", {
      sessionID: "sess-123",
      error: { message: "Authentication failed" },
    }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("myproject");
    expect(result).toContain("Authentication failed");
  });

  it("should format session.error with no error field using fallback", () => {
    const result = formatNotification("session.error", {
      sessionID: "sess-123",
    }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("myproject");
    expect(result?.toLowerCase()).toContain("unknown error");
  });

  it("should format permission.asked with project ID and permission type", () => {
    const result = formatNotification("permission.asked", {
      type: "bash",
      title: "Execute shell command",
      sessionID: "sess-123",
    }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("myproject");
    expect(result).toContain("bash");
    expect(result).toContain("Execute shell command");
  });

  it("should format permission.asked with pattern field", () => {
    const result = formatNotification("permission.asked", {
      type: "write",
      pattern: "/path/to/file.txt",
      title: "Write to file",
      sessionID: "sess-123",
    }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("myproject");
    expect(result).toContain("/path/to/file.txt");
  });

  it("should format permission.replied with project ID and response", () => {
    const result = formatNotification("permission.replied", {
      sessionID: "sess-123",
      permissionID: "perm-456",
      response: "allow",
    }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("myproject");
    expect(result).toContain("allow");
  });

  it("should format message.updated with project ID and text snippet", () => {
    const result = formatNotification("message.updated", {
      text: "Which file should I modify?",
      sessionID: "sess-123",
    }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("myproject");
    expect(result).toContain("Which file should I modify?");
  });

  it("should return null for unknown event type", () => {
    const result = formatNotification("unknown.event" as EventType, {}, "myproject");
    expect(result).toBeNull();
  });

  it("should truncate long error messages to 200 chars with ellipsis", () => {
    const longError = "x".repeat(300);
    const result = formatNotification("session.error", {
      sessionID: "sess-123",
      error: { message: longError },
    }, "myproject");
    expect(result).toBeTruthy();
    expect(result).toContain("...");
    // Should contain first 200 chars of error
    expect(result?.length).toBeLessThan(300);
  });

  it("should contain only plain text (no HTML or Markdown)", () => {
    const result = formatNotification("session.idle", { sessionID: "sess-123" }, "myproject");
    expect(result).toBeTruthy();
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("**");
    expect(result).not.toContain("__");
    // Brackets are OK for [projectId] format
    expect(result).not.toContain("`");
  });
});
