import type { ChannelConfig, PluginInput } from "./types.js";

type BunShell = PluginInput["$"];

export type Sender = { send(message: string): Promise<void> };

const MAX_MESSAGE_LENGTH = 4000;
const TRUNCATION_SUFFIX = "... [truncated]";
const CLI_TIMEOUT_MS = 10_000;

type ShellOutputLike = {
  exitCode: number;
};

type KillablePromise = Promise<ShellOutputLike> & {
  kill?(signal?: number | NodeJS.Signals): void;
};

function warn(message: string): void {
  process.stderr.write(`[notify-openclaw] ${message}\n`);
}

function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message;
  }

  return `${message.slice(0, MAX_MESSAGE_LENGTH)}${TRUNCATION_SUFFIX}`;
}

function createTimeout(): Promise<symbol> {
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(Symbol.for("notify-openclaw.timeout")),
      CLI_TIMEOUT_MS,
    );
  });
}

async function runCommand(
  channel: ChannelConfig,
  shell: BunShell,
  message: string,
): Promise<ShellOutputLike | symbol> {
  const command = (
    channel.account
      ? shell.nothrow()`openclaw message send --channel ${channel.channel} --target ${channel.target} --account ${channel.account} --message ${message}`
      : shell.nothrow()`openclaw message send --channel ${channel.channel} --target ${channel.target} --message ${message}`
  ) as KillablePromise;

  const result = await Promise.race<ShellOutputLike | symbol>([
    command,
    createTimeout(),
  ]);

  if (typeof result === "symbol") {
    command.kill?.("SIGTERM");
  }

  return result;
}

async function sendToChannel(
  channel: ChannelConfig,
  shell: BunShell,
  message: string,
): Promise<void> {
  try {
    const result = await runCommand(channel, shell, message);

    if (typeof result === "symbol") {
      warn(`openclaw timed out after ${CLI_TIMEOUT_MS}ms (channel: ${channel.channel})`);
      return;
    }

    if (result.exitCode === 0) {
      return;
    }

    if (result.exitCode === 127) {
      warn("openclaw not found");
      return;
    }

    warn(`openclaw exited with code ${result.exitCode} (channel: ${channel.channel})`);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    warn(`openclaw invocation failed (channel: ${channel.channel}): ${messageText}`);
  }
}

export function createSender(channels: ChannelConfig[], shell: BunShell): Sender {
  let busy = false;

  return {
    async send(message: string): Promise<void> {
      if (message.trim().length === 0) {
        return;
      }

      if (busy) {
        warn("dropping message because another send is already in flight");
        return;
      }

      busy = true;

      try {
        await Promise.all(
          channels.map((ch) => sendToChannel(ch, shell, truncateMessage(message))),
        );
      } finally {
        busy = false;
      }
    },
  };
}
