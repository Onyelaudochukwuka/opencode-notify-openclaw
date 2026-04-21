import { afterEach, beforeEach, describe, expect, it, mock, spyOn, vi } from "bun:test";
import type { $ } from "bun";
import { createSender } from "../cli.js";
import type { NotifyOpenclawConfig } from "../types.js";

type BunShell = typeof $;

type Invocation = {
  args: string[];
  expressions: string[];
  strings: string[];
};

type MockResult = {
  exitCode: number;
  stdout: Buffer;
  stderr: Buffer;
  text(encoding?: BufferEncoding): string;
  json(): unknown;
  arrayBuffer(): ArrayBuffer;
  bytes(): Uint8Array<ArrayBuffer>;
  blob(): Blob;
};

type MockCommand = Promise<MockResult> & {
  kill(signal?: number | NodeJS.Signals): void;
};

type Behavior =
  | { type: "resolve"; exitCode: number }
  | { type: "hang" };

const BASE_CONFIG: NotifyOpenclawConfig = {
  channel: "telegram",
  target: "@me",
  debounceMs: 3000,
  enableReplies: false,
  replyTimeoutMs: 120000,
  events: [],
};

function createMockResult(exitCode: number): MockResult {
  const stdout = Buffer.from("");
  const stderr = Buffer.from("");

  return {
    exitCode,
    stdout,
    stderr,
    text(encoding = "utf8") {
      return stdout.toString(encoding);
    },
    json() {
      return {};
    },
    arrayBuffer() {
      return stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength);
    },
    bytes() {
      return new Uint8Array(stdout);
    },
    blob() {
      return new Blob([stdout]);
    },
  };
}

function createMockShell(...behaviors: Behavior[]): { shell: BunShell; invocations: Invocation[]; killCalls: number } {
  const invocations: Invocation[] = [];
  let killCalls = 0;
  let index = 0;

  const shellTag = Object.assign(
    (strings: TemplateStringsArray, ...expressions: unknown[]) => {
      const args = strings.reduce<string[]>((tokens, chunk, chunkIndex) => {
        const words = chunk.split(/\s+/).filter(Boolean);
        tokens.push(...words);

        if (chunkIndex < expressions.length) {
          tokens.push(String(expressions[chunkIndex]));
        }

        return tokens;
      }, []);

      invocations.push({
        args,
        expressions: expressions.map(String),
        strings: [...strings],
      });

      const behavior = behaviors[index] ?? { type: "resolve", exitCode: 0 };
      index += 1;

      let resolveCommand: ((value: MockResult) => void) | undefined;
      const command = new Promise<MockResult>((resolve) => {
        resolveCommand = resolve;

        if (behavior.type === "resolve") {
          resolve(createMockResult(behavior.exitCode));
        }
      }) as MockCommand;

      command.kill = () => {
        killCalls += 1;

        if (behavior.type === "hang") {
          resolveCommand?.(createMockResult(143));
        }
      };

      return command;
    },
    {
      braces: (pattern: string) => [pattern],
      escape: (input: string) => input,
      env: () => shellTag,
      cwd: () => shellTag,
      nothrow: () => shellTag,
      throws: () => shellTag,
    },
  ) as unknown as BunShell;

  return {
    shell: shellTag,
    invocations,
    get killCalls() {
      return killCalls;
    },
  };
}

function getWarnings(writeSpy: { mock: { calls: Array<[unknown, ...unknown[]]> } }) {
  return writeSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
}

beforeEach(() => {
  mock.restore();
  vi.useRealTimers();
});

afterEach(() => {
  mock.restore();
  vi.useRealTimers();
});

describe("createSender", () => {
  it("sends successfully with required flags", async () => {
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send("hello world");

    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.args).toEqual([
      "openclaw",
      "message",
      "send",
      "--channel",
      "telegram",
      "--target",
      "@me",
      "--message",
      "hello world",
    ]);
  });

  it("includes --account when configured", async () => {
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender({ ...BASE_CONFIG, account: "primary" }, shell);

    await sender.send("hello world");

    expect(invocations[0]?.args).toEqual([
      "openclaw",
      "message",
      "send",
      "--channel",
      "telegram",
      "--target",
      "@me",
      "--account",
      "primary",
      "--message",
      "hello world",
    ]);
  });

  it("omits --account when not configured", async () => {
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send("hello world");

    expect(invocations[0]?.args).not.toContain("--account");
  });

  it("passes shell metacharacters literally", async () => {
    const message = "$(rm -rf /)";
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send(message);

    expect(invocations[0]?.expressions).toContain(message);
    expect(invocations[0]?.args.at(-1)).toBe(message);
  });

  it("passes backticks literally", async () => {
    const message = "`whoami`";
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send(message);

    expect(invocations[0]?.expressions).toContain(message);
  });

  it("passes single quotes literally", async () => {
    const message = "it's literal";
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send(message);

    expect(invocations[0]?.args.at(-1)).toBe(message);
  });

  it("passes double quotes literally", async () => {
    const message = 'say "hello"';
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send(message);

    expect(invocations[0]?.args.at(-1)).toBe(message);
  });

  it("passes newlines through unchanged", async () => {
    const message = "line one\nline two";
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send(message);

    expect(invocations[0]?.args.at(-1)).toBe(message);
  });

  it("warns and resolves on exit code 1", async () => {
    const writeSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    const { shell } = createMockShell({ type: "resolve", exitCode: 1 });
    const sender = createSender(BASE_CONFIG, shell);

    await expect(sender.send("hello")).resolves.toBeUndefined();
    expect(getWarnings(writeSpy)).toContain("openclaw exited with code 1");
  });

  it("warns when openclaw is not found", async () => {
    const writeSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    const { shell } = createMockShell({ type: "resolve", exitCode: 127 });
    const sender = createSender(BASE_CONFIG, shell);

    await expect(sender.send("hello")).resolves.toBeUndefined();
    expect(getWarnings(writeSpy)).toContain("openclaw not found");
  });

  it("times out after 10 seconds, kills the command, and resolves", async () => {
    vi.useFakeTimers();
    const writeSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    const shellState = createMockShell({ type: "hang" });
    const { shell } = shellState;
    const sender = createSender(BASE_CONFIG, shell);
    const sendPromise = sender.send("hello");

    vi.advanceTimersByTime(10_000);
    await sendPromise;

    expect(shellState.killCalls).toBe(1);
    expect(getWarnings(writeSpy)).toContain("timed out after 10000ms");
  });

  it("truncates messages longer than 4000 characters", async () => {
    const longMessage = "a".repeat(4001);
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send(longMessage);

    const sentMessage = invocations[0]?.args.at(-1);
    expect(sentMessage?.endsWith("... [truncated]")).toBe(true);
    expect(sentMessage).toHaveLength(4000 + "... [truncated]".length);
  });

  it("skips empty or whitespace-only messages", async () => {
    const { shell, invocations } = createMockShell({ type: "resolve", exitCode: 0 });
    const sender = createSender(BASE_CONFIG, shell);

    await sender.send("   \n\t  ");

    expect(invocations).toHaveLength(0);
  });

  it("drops concurrent sends while one is already in flight", async () => {
    const writeSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    let resolveFirst: (() => void) | undefined;
    const command = new Promise<MockResult>((resolve) => {
      resolveFirst = () => resolve(createMockResult(0));
    }) as MockCommand;
    command.kill = () => {};

    const invocations: Invocation[] = [];
    const shellTag = Object.assign(
      (strings: TemplateStringsArray, ...expressions: unknown[]) => {
        invocations.push({
          args: strings.flatMap((chunk, chunkIndex) => {
            const words = chunk.split(/\s+/).filter(Boolean);

            if (chunkIndex < expressions.length) {
              return [...words, String(expressions[chunkIndex])];
            }

            return words;
          }),
          expressions: expressions.map(String),
          strings: [...strings],
        });
        return command;
      },
      {
        braces: (pattern: string) => [pattern],
        escape: (input: string) => input,
        env: () => shellTag,
        cwd: () => shellTag,
        nothrow: () => shellTag,
        throws: () => shellTag,
      },
    ) as unknown as BunShell;

    const sender = createSender(BASE_CONFIG, shellTag);

    const firstSend = sender.send("first");
    const secondSend = sender.send("second");

    await Promise.resolve();
    resolveFirst?.();
    await Promise.all([firstSend, secondSend]);

    expect(invocations).toHaveLength(1);
    expect(getWarnings(writeSpy)).toContain("dropping message because another send is already in flight");
  });
});
