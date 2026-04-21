import type { Hooks, Plugin } from "@opencode-ai/plugin";
import { createSender } from "./cli.js";
import { loadConfig } from "./config.js";
import { createDebouncer } from "./debounce.js";
import { shouldNotify } from "./filter.js";
import { formatNotification } from "./format.js";
import { createPermissionTracker } from "./permissions.js";
import { createReplyRouter } from "./router.js";
import type { ReplyRouter } from "./router.js";
import { createReplyServer } from "./server.js";
import type { EventType, NotifyOpenclawConfig } from "./types.js";

function warn(message: string): void {
  process.stderr.write(`[notify-openclaw] ${message}\n`);
}

function hasOptions(
  options?: Record<string, unknown>,
): options is Record<string, unknown> {
  return options !== undefined && Object.keys(options).length > 0;
}

function extractText(parts: Array<{ type?: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
}

function normalizeSessionErrorPayload(payload: {
  sessionID?: string;
  error?: { message?: string; data?: { message?: string } };
}): { sessionID?: string; error?: { message?: string } } {
  return {
    error: payload.error
      ? {
          message: payload.error.message ?? payload.error.data?.message,
        }
      : undefined,
    sessionID: payload.sessionID,
  };
}

const plugin: Plugin = async (input, options) => {
  if (!hasOptions(options)) {
    return {};
  }

  let config: NotifyOpenclawConfig;

  try {
    config = loadConfig(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warn(message);
    return {};
  }

  const sender = createSender(config, input.$);
  const enabledEvents = new Set<EventType>(config.events);
  const projectId = input.project.id;
  let permissionTracker: ReturnType<typeof createPermissionTracker> | null = null;
  let replyRouter: ReplyRouter | null = null;
  let stopReplyServer: (() => void) | null = null;

  if (config.enableReplies) {
    const portFilePath = `/tmp/opencode-notify-openclaw-${process.pid}.port`;
    permissionTracker = createPermissionTracker();
    replyRouter = createReplyRouter({
      client: input.client,
      permissionTracker,
      warn,
    });
    const replyServer = createReplyServer({
      portFilePath,
      onReply: (text) => {
        void replyRouter?.handleReply(text);
      },
    });

    stopReplyServer = () => {
      replyServer.stop();
    };

    process.once("exit", () => {
      stopReplyServer?.();
    });
  }

  const send = async (
    eventType: EventType,
    payload: unknown,
  ): Promise<void> => {
    if (!enabledEvents.has(eventType)) {
      return;
    }

    const message = formatNotification(eventType, payload as never, projectId);
    if (!message) {
      return;
    }

    await sender.send(message);
  };

  const idleDebouncer = createDebouncer<string>(
    config.debounceMs,
    (message) => {
      void sender.send(message);
    },
  );

  const hooks: Hooks = {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.idle": {
          if (!enabledEvents.has("session.idle")) {
            return;
          }

          const message = formatNotification(
            "session.idle",
            event.properties as never,
            projectId,
          );
          if (!message) {
            return;
          }

          idleDebouncer.trigger(message);
          return;
        }
        case "session.error":
          await send(
            "session.error",
            normalizeSessionErrorPayload(
              event.properties as {
                sessionID?: string;
                error?: { message?: string; data?: { message?: string } };
              },
            ),
          );
          return;
        case "permission.replied":
          await send("permission.replied", event.properties);
          return;
        default:
          return;
      }
    },
    "permission.ask": async (permission, output) => {
      if (output.status !== "ask") {
        return;
      }

      if (config.enableReplies) {
        permissionTracker!.trackPermission(permission.sessionID, permission.id);

        const notificationMessage = formatNotification(
          "permission.asked",
          permission,
          projectId,
          { replyHints: true },
        );

        if (notificationMessage && enabledEvents.has("permission.asked")) {
          await sender.send(notificationMessage);
        }

        const result = await permissionTracker!.awaitReply(
          permission.sessionID,
          permission.id,
          config.replyTimeoutMs,
        );

        if (result !== null) {
          output.status = result.response === "reject" ? "deny" : "allow";

          try {
            await input.client.postSessionIdPermissionsPermissionId({
              path: { id: permission.sessionID, permissionID: permission.id },
              body: { response: result.response },
            });
          } catch (error) {
            warn(
              `permission SDK call failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        return;
      }

      await send("permission.asked", permission);
    },
    "chat.message": async (chatInput, output) => {
      if (!enabledEvents.has("message.updated")) {
        return;
      }

      const text = extractText(
        output.parts as Array<{ type?: string; text?: string }>,
      );
      if (!text || !shouldNotify(text)) {
        return;
      }

      await send("message.updated", { sessionID: chatInput.sessionID, text });
    },
  };

  return hooks;
};

export default plugin;
