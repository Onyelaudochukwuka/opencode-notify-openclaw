import { afterEach, describe, expect, it } from "bun:test";
import plugin from "../index.js";
import type { PluginInput, PluginOptions } from "@opencode-ai/plugin";
import type {
  EventPermissionReplied,
  EventSessionError,
  EventSessionIdle,
  Permission,
  Project,
  TextPart,
  ToolPart,
  UserMessage,
} from "@opencode-ai/sdk";

type ShellCall = {
  expressions: unknown[];
};

function createShell(calls: ShellCall[]) {
  const shell = Object.assign(
    (_strings: TemplateStringsArray, ...expressions: unknown[]) => {
      calls.push({ expressions });
      return Promise.resolve({ exitCode: 0 });
    },
    {
      braces: () => [],
      cwd: () => shell,
      env: () => shell,
      escape: (input: string) => input,
      nothrow: () => shell,
      throws: () => shell,
    },
  );

  return shell;
}

function createInput(calls: ShellCall[]): PluginInput {
  return {
    client: {} as PluginInput["client"],
    directory: "/tmp/project",
    experimental_workspace: {
      register: () => {},
    },
    project: {
      id: "project-123",
      time: { created: Date.now() },
      worktree: "/tmp/project",
    } satisfies Project,
    serverUrl: new URL("http://localhost:4096"),
    worktree: "/tmp/project",
    $: createShell(calls) as unknown as PluginInput["$"],
  };
}

function createPermission(overrides: Partial<Permission> = {}): Permission {
  return {
    id: "perm-1",
    messageID: "msg-1",
    metadata: {},
    sessionID: "sess-1",
    time: { created: Date.now() },
    title: "Execute shell command",
    type: "bash",
    ...overrides,
  };
}

function createUserMessage(overrides: Partial<UserMessage> = {}): UserMessage {
  return {
    agent: "assistant",
    id: "user-msg-1",
    model: { modelID: "gpt-5.4", providerID: "openai" },
    role: "user",
    sessionID: "sess-1",
    time: { created: Date.now() },
    ...overrides,
  };
}

function createTextPart(text: string, overrides: Partial<TextPart> = {}): TextPart {
  return {
    id: "text-part-1",
    messageID: "msg-1",
    sessionID: "sess-1",
    text,
    type: "text",
    ...overrides,
  };
}

function createToolPart(overrides: Partial<ToolPart> = {}): ToolPart {
  return {
    callID: "call-1",
    id: "tool-part-1",
    messageID: "msg-1",
    sessionID: "sess-1",
    state: {
      input: {},
      metadata: {},
      output: "ok",
      status: "completed",
      time: { end: Date.now(), start: Date.now() },
      title: "bash completed",
    },
    tool: "bash",
    type: "tool",
    ...overrides,
  };
}

function createSessionIdleEvent(sessionID = "sess-1"): EventSessionIdle {
  return {
    properties: { sessionID },
    type: "session.idle",
  };
}

function createSessionErrorEvent(message: string, sessionID = "sess-1"): EventSessionError {
  return {
    properties: {
      error: { data: { message }, name: "UnknownError" },
      sessionID,
    },
    type: "session.error",
  };
}

function createPermissionRepliedEvent(response: string, sessionID = "sess-1"): EventPermissionReplied {
  return {
    properties: { permissionID: "perm-1", response, sessionID },
    type: "permission.replied",
  };
}

function getMessages(calls: ShellCall[]): string[] {
  return calls.map((call) => String(call.expressions[call.expressions.length - 1]));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const originalStderrWrite = process.stderr.write.bind(process.stderr);

afterEach(() => {
  process.stderr.write = originalStderrWrite;
});

describe("plugin entrypoint", () => {
  it("returns a graceful no-op when options are missing", async () => {
    const calls: ShellCall[] = [];

    const hooks = await plugin(createInput(calls), undefined);

    expect(hooks).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("returns a graceful no-op when options are empty", async () => {
    const calls: ShellCall[] = [];

    const hooks = await plugin(createInput(calls), {});

    expect(hooks).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("returns the expected hook object shape when configured", async () => {
    const hooks = await plugin(createInput([]), {
      channel: "telegram",
      debounceMs: 10,
      target: "@me",
    });

    expect(hooks.event).toBeFunction();
    expect(hooks["permission.ask"]).toBeFunction();
    expect(hooks["chat.message"]).toBeFunction();
  });

  it("logs config validation errors and returns a graceful no-op", async () => {
    const calls: ShellCall[] = [];
    let stderr = "";
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += String(chunk);
      return true;
    }) as typeof process.stderr.write;

    const hooks = await plugin(createInput(calls), { target: "@me" });

    expect(hooks).toEqual({});
    expect(calls).toHaveLength(0);
    expect(stderr).toContain("notify-openclaw");
    expect(stderr).toContain("channel");
  });

  it("routes session.idle through the debouncer and session.error immediately", async () => {
    const calls: ShellCall[] = [];
    const hooks = await plugin(createInput(calls), {
      channel: "telegram",
      debounceMs: 10,
      events: ["session.idle", "session.error"],
      target: "@me",
    });

    await hooks.event?.({
      event: createSessionIdleEvent(),
    });

    expect(calls).toHaveLength(0);

    await hooks.event?.({
      event: createSessionErrorEvent("Auth failed"),
    });

    expect(getMessages(calls)).toContain("⚠️ [project-123] Error: Auth failed");

    await sleep(25);

    expect(getMessages(calls)).toContain("🔔 [project-123] OpenCode is waiting for your input");
  });

  it("sends permission.asked from permission.ask immediately when configured", async () => {
    const calls: ShellCall[] = [];
    const hooks = await plugin(createInput(calls), {
      channel: "telegram",
      debounceMs: 10,
      events: ["permission.asked"],
      target: "@me",
    });

    await hooks["permission.ask"]?.(
      createPermission(),
      { status: "ask" },
    );

    expect(getMessages(calls)).toEqual([
      "🔐 [project-123] Permission needed: bash — Execute shell command",
    ]);
  });

  it("routes permission.replied immediately through the event hook", async () => {
    const calls: ShellCall[] = [];
    const hooks = await plugin(createInput(calls), {
      channel: "telegram",
      debounceMs: 10,
      events: ["permission.replied"],
      target: "@me",
    });

    await hooks.event?.({
      event: createPermissionRepliedEvent("allow"),
    });

    expect(getMessages(calls)).toEqual(["✅ [project-123] Permission resolved: allow"]);
  });

  it("extracts only text parts from chat.message, filters them, and sends message.updated", async () => {
    const calls: ShellCall[] = [];
    const hooks = await plugin(createInput(calls), {
      channel: "telegram",
      debounceMs: 10,
      events: ["message.updated"],
      target: "@me",
    } satisfies PluginOptions);

    await hooks["chat.message"]?.(
      { messageID: "msg-1", sessionID: "sess-1" },
      {
        message: createUserMessage(),
        parts: [
          createTextPart("I checked the code.", { id: "part-1" }),
          createToolPart({ id: "part-2", messageID: "msg-1", sessionID: "sess-1" }),
          createTextPart(" Which file should I modify?", { id: "part-3" }),
        ],
      },
    );

    expect(getMessages(calls)).toEqual([
      "💬 [project-123] OpenCode asks: I checked the code. Which file should I modify?",
    ]);
  });

  it("filters non-question message.updated text and does not send", async () => {
    const calls: ShellCall[] = [];
    const hooks = await plugin(createInput(calls), {
      channel: "telegram",
      debounceMs: 10,
      events: ["message.updated"],
      target: "@me",
    });

    await hooks["chat.message"]?.(
      { messageID: "msg-1", sessionID: "sess-1" },
      {
        message: createUserMessage(),
        parts: [createTextPart("I finished the implementation.")],
      },
    );

    expect(calls).toHaveLength(0);
  });

  it("does not send permission.asked when permission.ask status is not ask", async () => {
    const calls: ShellCall[] = [];
    const hooks = await plugin(createInput(calls), {
      channel: "telegram",
      debounceMs: 10,
      events: ["permission.asked"],
      target: "@me",
    });

    await hooks["permission.ask"]?.(createPermission(), { status: "allow" });

    expect(calls).toHaveLength(0);
  });

  it("silently ignores excluded events", async () => {
    const calls: ShellCall[] = [];
    const hooks = await plugin(createInput(calls), {
      channel: "telegram",
      debounceMs: 10,
      events: ["session.error"],
      target: "@me",
    });

    await hooks.event?.({
      event: createSessionIdleEvent(),
    });
    await hooks["permission.ask"]?.(
      createPermission(),
      { status: "ask" },
    );
    await hooks["chat.message"]?.(
      { messageID: "msg-1", sessionID: "sess-1" },
      {
        message: createUserMessage(),
        parts: [createTextPart("Which file should I modify?", { id: "part-1" })],
      },
    );

    await sleep(25);

    expect(calls).toHaveLength(0);
  });
});
