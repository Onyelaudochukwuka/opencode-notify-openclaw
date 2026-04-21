import type { EventType } from "./types.js";

export type SessionIdlePayload = { sessionID: string };
export type SessionErrorPayload = { sessionID?: string; error?: { message?: string } };
export type PermissionAskedPayload = {
  type: string;
  pattern?: string | string[];
  title: string;
  sessionID: string;
};
export type PermissionRepliedPayload = {
  sessionID: string;
  permissionID: string;
  response: string;
};
export type MessageUpdatedPayload = { text: string; sessionID: string };

export type EventPayload =
  | SessionIdlePayload
  | SessionErrorPayload
  | PermissionAskedPayload
  | PermissionRepliedPayload
  | MessageUpdatedPayload;

/**
 * Truncate text to a maximum length, appending "..." if truncated.
 */
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function formatSessionIdle(_payload: SessionIdlePayload, projectId: string): string {
  return `🔔 [${projectId}] OpenCode is waiting for your input`;
}

function formatSessionError(payload: SessionErrorPayload, projectId: string): string {
  const errorMessage = payload.error?.message || "unknown error";
  const truncated = truncate(errorMessage, 200);
  return `⚠️ [${projectId}] Error: ${truncated}`;
}

function formatPermissionAsked(payload: PermissionAskedPayload, projectId: string): string {
  const titleTruncated = truncate(payload.title, 100);
  let message = `🔐 [${projectId}] Permission needed: ${payload.type} — ${titleTruncated}`;

  if (payload.pattern) {
    const pattern = Array.isArray(payload.pattern) ? payload.pattern[0] : payload.pattern;
    message += ` (${pattern})`;
  }

  return message;
}

function formatPermissionReplied(payload: PermissionRepliedPayload, projectId: string): string {
  return `✅ [${projectId}] Permission resolved: ${payload.response}`;
}

function formatMessageUpdated(payload: MessageUpdatedPayload, projectId: string): string {
  const textTruncated = truncate(payload.text, 200);
  return `💬 [${projectId}] OpenCode asks: ${textTruncated}`;
}

export function formatNotification(
  eventType: EventType,
  payload: EventPayload,
  projectId: string,
): string | null {
  switch (eventType) {
    case "session.idle":
      return formatSessionIdle(payload as SessionIdlePayload, projectId);
    case "session.error":
      return formatSessionError(payload as SessionErrorPayload, projectId);
    case "permission.asked":
      return formatPermissionAsked(payload as PermissionAskedPayload, projectId);
    case "permission.replied":
      return formatPermissionReplied(payload as PermissionRepliedPayload, projectId);
    case "message.updated":
      return formatMessageUpdated(payload as MessageUpdatedPayload, projectId);
    default:
      return null;
  }
}
