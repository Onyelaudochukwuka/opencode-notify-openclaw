import type { $ } from "bun";
import type { NotifyOpenclawConfig } from "./types.js";

type BunShell = typeof $;

export type Sender = { send(message: string): Promise<void> };

const MAX_MESSAGE_LENGTH = 4000;
const TRUNCATION_SUFFIX = "... [truncated]";
const CLI_TIMEOUT_MS = 10_000;

let busy = false;

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
    setTimeout(() => resolve(Symbol.for("notify-openclaw.timeout")), CLI_TIMEOUT_MS);
  });
}

async function runCommand(
  config: NotifyOpenclawConfig,
  shell: BunShell,
  message: string,
): Promise<ShellOutputLike | symbol> {
  const command = (
    config.account
      ? shell
          .nothrow()`openclaw message send --channel ${config.channel} --target ${config.target} --account ${config.account} --message ${message}`
      : shell
          .nothrow()`openclaw message send --channel ${config.channel} --target ${config.target} --message ${message}`
  ) as KillablePromise;

  const result = await Promise.race<ShellOutputLike | symbol>([command, createTimeout()]);

  if (typeof result === "symbol") {
    command.kill?.("SIGTERM");
  }

  return result;
}

export function createSender(config: NotifyOpenclawConfig, shell: BunShell): Sender {
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
        const result = await runCommand(config, shell, truncateMessage(message));

        if (typeof result === "symbol") {
          warn(`openclaw timed out after ${CLI_TIMEOUT_MS}ms`);
          return;
        }

        if (result.exitCode === 0) {
          return;
        }

        if (result.exitCode === 127) {
          warn("openclaw not found");
          return;
        }

        warn(`openclaw exited with code ${result.exitCode}`);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        warn(`openclaw invocation failed: ${messageText}`);
      } finally {
        busy = false;
      }
    },
  };
}
