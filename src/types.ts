import type { PluginInput, PluginOptions } from "@opencode-ai/plugin";

export type { PluginInput, PluginOptions };

export type EventType =
  | "session.idle"
  | "session.error"
  | "permission.asked"
  | "permission.replied"
  | "message.updated";

export type NotifyOpenclawConfig = {
  channel: string;
  target: string;
  account?: string;
  debounceMs: number;
  events: EventType[];
};

export const DEFAULT_EVENTS: EventType[] = [
  "session.idle",
  "session.error",
  "permission.asked",
  "permission.replied",
  "message.updated",
];

export const DEFAULT_DEBOUNCE_MS = 3000;
