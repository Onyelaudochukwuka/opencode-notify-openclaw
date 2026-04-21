// Copyright (c) 2026 Udochukwuka Onyela
import type { PluginInput } from "@opencode-ai/plugin";
import type { Session } from "@opencode-ai/sdk";
import { parseReply } from "./keywords.js";
import type { PermissionTracker } from "./permissions.js";

type OpencodeClient = PluginInput["client"];

type HandleReplyResult = {
  ok: boolean;
  action: string;
};

export type ReplyRouter = {
  handleReply(text: string): Promise<HandleReplyResult>;
};

function getMostRecentSession(sessions: Session[]): Session | null {
  if (sessions.length === 0) {
    return null;
  }

  return [...sessions].sort((left, right) => right.time.updated - left.time.updated)[0] ?? null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function sendFreeText(
  client: OpencodeClient,
  warn: (message: string) => void,
  text: string,
): Promise<HandleReplyResult> {
  try {
    const result = await client.session.list();
    const sessions = result.data ?? [];
    const session = getMostRecentSession(sessions);

    if (session === null) {
      warn("reply router could not find a session for free text injection");
      return { ok: false, action: "no-sessions" };
    }

    await client.session.promptAsync({
      path: { id: session.id },
      body: {
        parts: [{ type: "text", text }],
      },
    });

    return { ok: true, action: "freetext-sent" };
  } catch (error) {
    warn(`reply router SDK call failed: ${getErrorMessage(error)}`);
    return { ok: false, action: "sdk-error" };
  }
}

export function createReplyRouter(deps: {
  client: OpencodeClient;
  permissionTracker: PermissionTracker;
  warn: (msg: string) => void;
}): ReplyRouter {
  return {
    async handleReply(text: string): Promise<HandleReplyResult> {
      const parsed = parseReply(text);

      if (parsed === null) {
        return { ok: false, action: "empty-input" };
      }

      if (parsed.type === "permission") {
        const resolved = deps.permissionTracker.resolvePending(parsed.response);
        if (resolved !== null) {
          return { ok: true, action: "permission-resolved" };
        }

        return sendFreeText(deps.client, deps.warn, text);
      }

      return sendFreeText(deps.client, deps.warn, parsed.text);
    },
  };
}
