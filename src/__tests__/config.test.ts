import { describe, it, expect } from "bun:test";
import { loadConfig } from "../config.js";
import type { PluginOptions } from "@opencode-ai/plugin";

describe("loadConfig", () => {
  it("should load a valid full config with all fields", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me", account: "acc1" }],
      debounceMs: 5000,
      events: ["session.idle"],
    };

    const config = loadConfig(options);

    expect(config.channels[0]!.channel).toBe("telegram");
    expect(config.channels[0]!.target).toBe("@me");
    expect(config.channels[0]!.account).toBe("acc1");
    expect(config.debounceMs).toBe(5000);
    expect(config.events).toEqual(["session.idle"]);
  });

  it("should use defaults for minimal config (channels array only)", () => {
    const options: PluginOptions = {
      channels: [{ channel: "whatsapp", target: "+15555550123" }],
    };

    const config = loadConfig(options);

    expect(config.channels[0]!.channel).toBe("whatsapp");
    expect(config.channels[0]!.target).toBe("+15555550123");
    expect(config.channels[0]!.account).toBeUndefined();
    expect(config.debounceMs).toBe(3000);
    expect(config.events).toEqual([
      "session.idle",
      "session.error",
      "permission.asked",
      "permission.replied",
      "message.updated",
    ]);
  });

  it("should throw when channels is missing", () => {
    const options: PluginOptions = {};

    expect(() => loadConfig(options)).toThrow(/channels/i);
  });

  it("should throw when channels is empty array", () => {
    const options: PluginOptions = {
      channels: [],
    };

    expect(() => loadConfig(options)).toThrow(/channels/i);
  });

  it("should throw error when debounceMs is 0", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      debounceMs: 0,
    };

    expect(() => loadConfig(options)).toThrow();
  });

  it("should throw error when debounceMs is negative", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      debounceMs: -100,
    };

    expect(() => loadConfig(options)).toThrow();
  });

  it("should filter unknown event names from events array", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      events: ["session.idle", "unknown.event", "session.error"],
    };

    const config = loadConfig(options);

    expect(config.events).toEqual(["session.idle", "session.error"]);
  });

  it("should allow empty events array (explicit opt-out)", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      events: [],
    };

    const config = loadConfig(options);

    expect(config.events).toEqual([]);
  });

  it("should set account to undefined when not provided", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
    };

    const config = loadConfig(options);

    expect(config.channels[0]!.account).toBeUndefined();
  });

  it("should ignore extra unknown keys in options", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      unknownKey: "should be ignored",
      anotherUnknown: 12345,
    };

    const config = loadConfig(options);

    expect(config.channels[0]!.channel).toBe("telegram");
    expect(config.channels[0]!.target).toBe("@me");
    expect(Object.hasOwn(config, "unknownKey")).toBe(false);
    expect(Object.hasOwn(config, "anotherUnknown")).toBe(false);
  });
});

describe("loadConfig — replies and timeouts", () => {

  it("should default enableReplies to true when not provided", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
    };

    const config = loadConfig(options);

    expect(config.enableReplies).toBe(true);
  });

  it("should accept enableReplies: true as-is", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      enableReplies: true,
    };

    const config = loadConfig(options);

    expect(config.enableReplies).toBe(true);
  });

  it("should default enableReplies to true when given non-boolean value", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      enableReplies: "yes" as unknown as boolean,
    };

    const config = loadConfig(options);

    expect(config.enableReplies).toBe(true);
  });

  it("should default replyTimeoutMs to 120000 when not provided", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
    };

    const config = loadConfig(options);

    expect(config.replyTimeoutMs).toBe(120000);
  });

  it("should accept replyTimeoutMs: 60000 as-is", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      replyTimeoutMs: 60000,
    };

    const config = loadConfig(options);

    expect(config.replyTimeoutMs).toBe(60000);
  });

  it("should default replyTimeoutMs to 120000 when given 0", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      replyTimeoutMs: 0,
    };

    const config = loadConfig(options);

    expect(config.replyTimeoutMs).toBe(120000);
  });

  it("should default replyTimeoutMs to 120000 when given negative value", () => {
    const options: PluginOptions = {
      channels: [{ channel: "telegram", target: "@me" }],
      replyTimeoutMs: -1,
    };

    const config = loadConfig(options);

    expect(config.replyTimeoutMs).toBe(120000);
  });
});
