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
      ? shell.nothrow()`openclaw message send --channel ${channel.channel} --target ${channel.target} --account ${channel.account} --message ${message} > /dev/null 2>&1`
      : shell.nothrow()`openclaw message send --channel ${channel.channel} --target ${channel.target} --message ${message} > /dev/null 2>&1`
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
      return;
    }

    if (result.exitCode === 0) {
      return;
    }

    if (result.exitCode === 127) {
      return;
    }

  } catch {
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
