import type { PluginOptions } from "@opencode-ai/plugin";
import type { ChannelConfig, NotifyOpenclawConfig, EventType } from "./types.js";
import { DEFAULT_DEBOUNCE_MS, DEFAULT_EVENTS, DEFAULT_REPLY_TIMEOUT_MS } from "./types.js";

const VALID_EVENTS = new Set<EventType>([
  "session.idle",
  "session.error",
  "permission.asked",
  "permission.replied",
  "message.updated",
]);

function parseChannelConfig(item: unknown, index: number): ChannelConfig {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new Error(`Config validation failed: channels[${index}] must be an object`);
  }
  const obj = item as Record<string, unknown>;
  if (typeof obj.channel !== "string") {
    throw new Error(`Config validation failed: channels[${index}].channel is required and must be a string`);
  }
  if (typeof obj.target !== "string") {
    throw new Error(`Config validation failed: channels[${index}].target is required and must be a string`);
  }
  return {
    channel: obj.channel,
    target: obj.target,
    account: typeof obj.account === "string" ? obj.account : undefined,
  };
}

export function loadConfig(options: PluginOptions): NotifyOpenclawConfig {
  if (!Array.isArray(options.channels) || options.channels.length === 0) {
    throw new Error("Config validation failed: channels must be a non-empty array");
  }

  const channels = options.channels.map((item, i) => parseChannelConfig(item, i));

  // Validate debounceMs (optional, must be > 0 if provided)
  let debounceMs = DEFAULT_DEBOUNCE_MS;
  if (options.debounceMs !== undefined) {
    const ms = Number(options.debounceMs);
    if (!Number.isFinite(ms) || ms <= 0) {
      throw new Error("Config validation failed: debounceMs must be a positive number");
    }
    debounceMs = ms;
  }

  // Validate events (optional, filter to valid EventType values)
  let events: EventType[] = DEFAULT_EVENTS;
  if (options.events !== undefined) {
    if (!Array.isArray(options.events)) {
      throw new Error("Config validation failed: events must be an array");
    }
    events = options.events.filter((event): event is EventType => {
      return typeof event === "string" && VALID_EVENTS.has(event as EventType);
    });
  }

  // Validate enableReplies (optional, defaults to true)
  const enableReplies = typeof options?.enableReplies === "boolean" ? options.enableReplies : true;

  // Validate replyTimeoutMs (optional, must be > 0 if provided)
  const replyTimeoutMs =
    typeof options?.replyTimeoutMs === "number" && options.replyTimeoutMs > 0
      ? options.replyTimeoutMs
      : DEFAULT_REPLY_TIMEOUT_MS;

  return {
    channels,
    debounceMs,
    enableReplies,
    replyTimeoutMs,
    events,
  };
}
