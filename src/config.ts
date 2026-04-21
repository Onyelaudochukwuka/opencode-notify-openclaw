import type { PluginOptions } from "@opencode-ai/plugin";
import type { NotifyOpenclawConfig, EventType } from "./types.js";
import { DEFAULT_DEBOUNCE_MS, DEFAULT_EVENTS } from "./types.js";

const VALID_EVENTS = new Set<EventType>([
  "session.idle",
  "session.error",
  "permission.asked",
  "permission.replied",
  "message.updated",
]);

export function loadConfig(options: PluginOptions): NotifyOpenclawConfig {
  // Validate channel (required string)
  if (typeof options.channel !== "string") {
    throw new Error("Config validation failed: channel is required and must be a string");
  }

  // Validate target (required string)
  if (typeof options.target !== "string") {
    throw new Error("Config validation failed: target is required and must be a string");
  }

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

  // Extract account (optional, string or undefined)
  const account = typeof options.account === "string" ? options.account : undefined;

  return {
    channel: options.channel,
    target: options.target,
    account,
    debounceMs,
    events,
  };
}
