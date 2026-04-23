import type { PluginInput, PluginOptions } from "@opencode-ai/plugin";

export type { PluginInput, PluginOptions };

export type EventType =
  | "session.idle"
  | "session.error"
  | "permission.asked"
  | "permission.replied"
  | "message.updated";

export type ChannelConfig = {
  channel: string;
  target: string;
  account?: string;
};

export type NotifyOpenclawConfig = {
  channels: ChannelConfig[];
  debounceMs: number;
  enableReplies: boolean;
  replyTimeoutMs: number;
  events: EventType[];
};

export const DEFAULT_EVENTS: EventType[] = [
  "session.idle",
  "session.error",
  "permission.asked",
  "permission.replied",
  "message.updated",
];

export const DEFAULT_DEBOUNCE_MS = 3000; // 30 seconds

export const DEFAULT_REPLY_TIMEOUT_MS = 120000; // 2 minutes
