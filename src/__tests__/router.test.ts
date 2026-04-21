// Copyright (c) 2026 Udochukwuka Onyela
import { describe, expect, it, mock } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Session } from "@opencode-ai/sdk";
import { createReplyRouter } from "../router.js";
import type { PendingResult, PermissionTracker } from "../permissions.js";

function createSession(id: string, updated: number): Session {
  return {
    id,
    time: { created: updated - 1000, updated },
  } as Session;
}

function createMockClient(sessions: Session[]) {
  return {
    session: {
      list: mock(() => Promise.resolve({ data: sessions })),
      promptAsync: mock(() => Promise.resolve({ data: undefined })),
    },
  } as unknown as PluginInput["client"];
}

function createMockPermissionTracker(resolvePendingReturn: PendingResult | null = null) {
  return {
    trackPermission: mock(() => {}),
    resolvePending: mock(() => resolvePendingReturn),
    awaitReply: mock(() => Promise.resolve(null)),
    clearAll: mock(() => {}),
    pendingCount: mock(() => 0),
  } satisfies PermissionTracker;
}

describe("createReplyRouter", () => {
  it("resolves a pending once permission reply without sending free text", async () => {
    const client = createMockClient([createSession("sess-1", 100)]);
    const permissionTracker = createMockPermissionTracker({
      permissionID: "perm-1",
      response: "once",
      sessionID: "sess-1",
    });
    const warn = mock(() => {});
    const router = createReplyRouter({ client, permissionTracker, warn });

    const result = await router.handleReply("yes");

    expect(result).toEqual({
      ok: true,
      action: "permission-resolved",
    });
    expect(permissionTracker.resolvePending).toHaveBeenCalledWith("once");
    expect(client.session.promptAsync).not.toHaveBeenCalled();
  });

  it("resolves an always permission reply", async () => {
    const client = createMockClient([createSession("sess-1", 100)]);
    const permissionTracker = createMockPermissionTracker({
      permissionID: "perm-1",
      response: "always",
      sessionID: "sess-1",
    });
    const router = createReplyRouter({ client, permissionTracker, warn: mock(() => {}) });

    await router.handleReply("always");

    expect(permissionTracker.resolvePending).toHaveBeenCalledWith("always");
    expect(client.session.promptAsync).not.toHaveBeenCalled();
  });

  it("resolves a reject permission reply", async () => {
    const client = createMockClient([createSession("sess-1", 100)]);
    const permissionTracker = createMockPermissionTracker({
      permissionID: "perm-1",
      response: "reject",
      sessionID: "sess-1",
    });
    const router = createReplyRouter({ client, permissionTracker, warn: mock(() => {}) });

    await router.handleReply("no");

    expect(permissionTracker.resolvePending).toHaveBeenCalledWith("reject");
    expect(client.session.promptAsync).not.toHaveBeenCalled();
  });

  it("falls through permission keywords with no pending request to free text", async () => {
    const client = createMockClient([createSession("sess-1", 100)]);
    const permissionTracker = createMockPermissionTracker(null);
    const router = createReplyRouter({ client, permissionTracker, warn: mock(() => {}) });

    const result = await router.handleReply("yes");

    expect(result).toEqual({
      ok: true,
      action: "freetext-sent",
    });
    expect(permissionTracker.resolvePending).toHaveBeenCalledWith("once");
    expect(client.session.promptAsync).toHaveBeenCalledWith({
      path: { id: "sess-1" },
      body: { parts: [{ type: "text", text: "yes" }] },
    });
  });

  it("sends free text replies with promptAsync", async () => {
    const client = createMockClient([createSession("sess-1", 100)]);
    const permissionTracker = createMockPermissionTracker();
    const router = createReplyRouter({ client, permissionTracker, warn: mock(() => {}) });

    const result = await router.handleReply("hello router");

    expect(result).toEqual({
      ok: true,
      action: "freetext-sent",
    });
    expect(client.session.list).toHaveBeenCalledTimes(1);
    expect(client.session.promptAsync).toHaveBeenCalledWith({
      path: { id: "sess-1" },
      body: { parts: [{ type: "text", text: "hello router" }] },
    });
  });

  it("routes free text to the most recently updated session", async () => {
    const client = createMockClient([
      createSession("older", 100),
      createSession("newest", 300),
      createSession("middle", 200),
    ]);
    const permissionTracker = createMockPermissionTracker();
    const router = createReplyRouter({ client, permissionTracker, warn: mock(() => {}) });

    await router.handleReply("route me");

    expect(client.session.promptAsync).toHaveBeenCalledWith({
      path: { id: "newest" },
      body: { parts: [{ type: "text", text: "route me" }] },
    });
  });

  it("warns and returns no-sessions when no sessions exist for free text", async () => {
    const client = createMockClient([]);
    const permissionTracker = createMockPermissionTracker();
    const warn = mock(() => {});
    const router = createReplyRouter({ client, permissionTracker, warn });

    const result = await router.handleReply("hello");

    expect(result).toEqual({
      ok: false,
      action: "no-sessions",
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(client.session.promptAsync).not.toHaveBeenCalled();
  });

  it("returns empty-input for blank replies", async () => {
    const client = createMockClient([createSession("sess-1", 100)]);
    const permissionTracker = createMockPermissionTracker();
    const router = createReplyRouter({ client, permissionTracker, warn: mock(() => {}) });

    const result = await router.handleReply("   ");

    expect(result).toEqual({
      ok: false,
      action: "empty-input",
    });
    expect(permissionTracker.resolvePending).not.toHaveBeenCalled();
    expect(client.session.list).not.toHaveBeenCalled();
  });

  it("warns and returns sdk-error when session.list throws", async () => {
    const error = new Error("list exploded");
    const client = {
      session: {
        list: mock(() => Promise.reject(error)),
        promptAsync: mock(() => Promise.resolve({ data: undefined })),
      },
    } as unknown as PluginInput["client"];
    const permissionTracker = createMockPermissionTracker();
    const warn = mock(() => {});
    const router = createReplyRouter({ client, permissionTracker, warn });

    const result = await router.handleReply("hello");

    expect(result).toEqual({
      ok: false,
      action: "sdk-error",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("list exploded"));
  });
});
