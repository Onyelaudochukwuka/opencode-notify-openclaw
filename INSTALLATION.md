# Installation Guide

This guide walks you through every step of installing, configuring, and verifying `opencode-notify-openclaw`. It covers all installation methods, per-channel Openclaw setup, the two-way reply bridge, and troubleshooting for every known failure mode.

If you just want the quick version, see the [README](./README.md). This document goes deeper.

---

## Table of Contents

- [Prerequisites](#prerequisites)
  - [Node.js 18+ or Bun](#nodejs-18-or-bun)
  - [OpenCode](#opencode)
  - [Openclaw CLI](#openclaw-cli)
- [Installation Methods](#installation-methods)
  - [npm](#npm)
  - [Bun](#bun)
  - [Local Development (Building from Source)](#local-development-building-from-source)
  - [Monorepo Installs](#monorepo-installs)
- [Configuring opencode.json](#configuring-opencodejson)
  - [Where the File Lives](#where-the-file-lives)
  - [Full Annotated Example](#full-annotated-example)
  - [Multi-Channel Setup](#multi-channel-setup)
  - [Per-Project vs. Global Configuration](#per-project-vs-global-configuration)
- [Channel-by-Channel Setup](#channel-by-channel-setup)
  - [Telegram](#telegram)
  - [WhatsApp](#whatsapp)
  - [Discord](#discord)
  - [Slack](#slack)
- [Two-Way Replies Setup](#two-way-replies-setup)
  - [What It Does](#what-it-does)
  - [Step 1: Enable in Config](#step-1-enable-in-config)
  - [Step 2: Set Up the Openclaw Hook](#step-2-set-up-the-openclaw-hook)
  - [Step 3: Run the Setup Script](#step-3-run-the-setup-script)
  - [Step 4: Verify the Bridge](#step-4-verify-the-bridge)
  - [Port File Details](#port-file-details)
  - [Timeout Behavior and Tuning](#timeout-behavior-and-tuning)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)
- [Uninstalling](#uninstalling)

---

## Prerequisites

Three things must be working before you install the plugin: a JavaScript runtime, OpenCode itself, and the Openclaw CLI. You also need at least one messaging channel configured in Openclaw.

### Node.js 18+ or Bun

The plugin requires Node.js 18 or later, or the Bun runtime. Either works. Bun is what the project uses internally for builds and tests, so if you don't have a preference, Bun is the path of least resistance.

**Check your Node.js version:**

```bash
node --version
```

You need `v18.0.0` or higher. If the command isn't found or shows a version below 18, install Node.js from [nodejs.org](https://nodejs.org). The LTS release is recommended.

**Check your Bun version:**

```bash
bun --version
```

Any current Bun release works. If the command isn't found, install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then restart your terminal so the `bun` command is on your PATH.

**Which should you use?** If you already have Node.js 18+, that's fine. If you're starting fresh, Bun is faster for installation and has native TypeScript support. The plugin works with both.

### OpenCode

OpenCode must be installed and able to start a session. The plugin loads through OpenCode's plugin system, so it won't do anything on its own.

**Install OpenCode:**

Follow the instructions at [opencode.ai](https://opencode.ai). The typical install is:

```bash
npm install -g opencode
```

**Verify OpenCode works:**

```bash
opencode --version
```

This should print a version number. If it doesn't, make sure the npm global bin directory is on your PATH. You can find it with `npm bin -g`.

**Locate your opencode.json:**

OpenCode reads its configuration from `opencode.json` in the current project directory. You'll create or edit this file in a later step. For now, just know where your project root is.

### Openclaw CLI

Openclaw is the CLI tool that actually delivers messages to Telegram, WhatsApp, Discord, Slack, and other channels. The plugin shells out to `openclaw message send` under the hood, so the CLI must be installed, authenticated, and working before the plugin can do anything.

**Install Openclaw:**

Follow the instructions at [openclaw.com](https://openclaw.com). After installation, confirm it's on your PATH:

```bash
openclaw --version
```

If this prints a version number, you're good. If you get "command not found", the binary isn't on your PATH. Check where Openclaw installed and add that directory to your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent).

**Authenticate with Openclaw:**

```bash
openclaw auth login
```

Follow the prompts. This stores your credentials locally so the CLI can send messages on your behalf.

**Verify authentication:**

```bash
openclaw auth status
```

This should show you're logged in. If it shows you're unauthenticated, re-run the login step.

**Test that you can send a message:**

Before touching the plugin at all, confirm Openclaw can reach your channel:

```bash
openclaw message send --dry-run --channel <your-channel> --target <your-target> --message "test"
```

Replace `<your-channel>` with the channel name (e.g. `telegram`, `whatsapp`, `discord`, `slack`) and `<your-target>` with the recipient identifier for that channel. The `--dry-run` flag validates everything without actually sending.

This command must exit with code 0 and no errors. If it fails, fix the Openclaw setup first. The plugin can't work around a broken CLI.

---

## Installation Methods

### npm

Standard npm install in your project directory:

```bash
npm install opencode-notify-openclaw
```

This installs the package locally and adds it to your `package.json` dependencies.

**Peer dependencies:** The plugin declares `@opencode-ai/plugin` as a peer dependency (version `>=1.0.0`). OpenCode provides this at runtime, so you don't need to install it yourself. npm 7+ will warn if the peer dependency isn't satisfied, but this warning is safe to ignore as long as you're running the plugin through OpenCode.

**Global install:** Don't install this globally. OpenCode loads plugins from project-level `node_modules`, not from global packages. A global install won't be found.

### Bun

```bash
bun add opencode-notify-openclaw
```

Bun handles peer dependencies more quietly than npm. Same result, faster install.

### Local Development (Building from Source)

If you want to modify the plugin or contribute changes, clone the repository and build it locally.

**1. Clone the repo:**

```bash
git clone https://github.com/onyelaudochukwuka/opencode-notify-openclaw.git
cd opencode-notify-openclaw
```

**2. Install dependencies:**

```bash
bun install
```

The project uses Bun for development. You can also use `npm install`, but the lockfile is `bun.lock`, so Bun gives you reproducible installs.

**3. Build:**

```bash
bun run build
```

This compiles `src/index.ts` into `dist/index.js` targeting Node.js, with `@opencode-ai/plugin` marked as external.

**4. Run the type checker (optional but recommended):**

```bash
bun run typecheck
```

**5. Run the test suite (optional but recommended):**

```bash
bun test
```

**6. Link it into your project:**

From the cloned directory:

```bash
npm link
```

Then in your project directory:

```bash
npm link opencode-notify-openclaw
```

Now your project's `node_modules/opencode-notify-openclaw` points to your local build. Any changes you make, rebuild with `bun run build`, and OpenCode picks them up on next restart.

**Alternative with Bun:** Instead of `npm link`, you can use a file path in your project's `package.json`:

```json
{
  "dependencies": {
    "opencode-notify-openclaw": "file:../opencode-notify-openclaw"
  }
}
```

Then run `bun install` in your project.

### Monorepo Installs

If your project lives in a monorepo (Turborepo, Nx, pnpm workspaces, npm workspaces, Bun workspaces), install the plugin in the workspace that has the `opencode.json` file.

**npm workspaces:**

```bash
npm install opencode-notify-openclaw --workspace=packages/my-app
```

**pnpm workspaces:**

```bash
pnpm add opencode-notify-openclaw --filter my-app
```

**Bun workspaces:**

```bash
bun add opencode-notify-openclaw --cwd packages/my-app
```

The important thing: the plugin must be resolvable from the directory where OpenCode runs. If your `opencode.json` is at the monorepo root, install there. If it's inside a specific package, install in that package.

**Hoisting note:** If your monorepo hoists dependencies to the root `node_modules`, the plugin will be available everywhere. This is usually fine. Just make sure `opencode.json` is in the right place (more on that below).

---

## Configuring opencode.json

### Where the File Lives

OpenCode looks for `opencode.json` in the project root, the directory where you run OpenCode from. This is typically the same directory as your `package.json`.

**Precedence rules:**

1. OpenCode first checks the current working directory for `opencode.json`
2. If not found, it checks the global OpenCode config directory (platform-dependent)

For most setups, put `opencode.json` in your project root. This keeps the config co-located with your code and version-controllable.

**Multiple projects:** Each project gets its own `opencode.json`. There's no way to share a single config file across projects, but you can copy the same plugin configuration into each one. If you want to avoid repeating yourself, consider a shell script or template that generates the file.

### Full Annotated Example

Here's an `opencode.json` with every plugin option set and explained:

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {

      "channel": "telegram",
      // Required. The Openclaw channel name.
      // Must match a channel you've configured in Openclaw.
      // Common values: "telegram", "whatsapp", "discord", "slack"

      "target": "@yourusername",
      // Required. The recipient identifier.
      // Format depends on the channel:
      //   Telegram:  "@username" or a chat ID
      //   WhatsApp:  "+1234567890" (E.164 phone number)
      //   Discord:   webhook URL
      //   Slack:     "#channel-name" or a webhook URL

      "account": "work",
      // Optional. Openclaw account name.
      // Only needed if you have multiple Openclaw accounts
      // and want to send from a specific one.
      // Omit this if you only have one account.

      "debounceMs": 3000,
      // Optional. Default: 3000 (3 seconds).
      // How long to wait after a session.idle event before sending
      // the notification. If another idle event fires within this
      // window, the timer resets. Must be greater than 0.
      // Only affects session.idle events; all other events send immediately.

      "events": [
        "session.idle",
        "session.error",
        "permission.asked",
        "permission.replied",
        "message.updated"
      ],
      // Optional. Default: all five events above.
      // List the events you want notifications for.
      // Omit this field to receive all events.
      // Unrecognized event names are silently ignored.

      "enableReplies": true,
      // Optional. Default: false.
      // When true, the plugin starts a local HTTP server
      // and listens for replies forwarded from Openclaw.
      // Requires additional Openclaw hook setup (see below).

      "replyTimeoutMs": 120000
      // Optional. Default: 120000 (2 minutes).
      // How long to wait for a reply to a permission notification
      // before giving up. Only used when enableReplies is true.
      // After timeout, the permission falls through to OpenCode's
      // normal interactive prompt.
    }]
  ]
}
```

> **Note:** JSON doesn't support comments. The comments above are for explanation only. Your actual `opencode.json` must be valid JSON without comments.

Here's the same config as valid, copy-pasteable JSON:

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourusername",
      "account": "work",
      "debounceMs": 3000,
      "events": [
        "session.idle",
        "session.error",
        "permission.asked",
        "permission.replied",
        "message.updated"
      ],
      "enableReplies": true,
      "replyTimeoutMs": 120000
    }]
  ]
}
```

**Minimal config** (the most common setup):

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourusername"
    }]
  ]
}
```

Only `channel` and `target` are required. Everything else has sensible defaults.

### Multi-Channel Setup

To receive notifications on more than one channel, add the plugin tuple multiple times:

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourusername"
    }],
    ["opencode-notify-openclaw", {
      "channel": "slack",
      "target": "#dev-alerts"
    }]
  ]
}
```

Each tuple is an independent plugin instance. They don't share state. Each one sends to its own channel with its own configuration. You can enable replies on one and not the other, use different debounce times, or subscribe to different events.

**Gotcha:** If you enable `enableReplies: true` on multiple instances, each one starts its own HTTP server on a different port. The Openclaw hook (which uses a glob pattern for the port file) will pick up whichever port file it finds first. This is unpredictable. If you need two-way replies, enable it on only one channel instance.

### Per-Project vs. Global Configuration

**Per-project** (recommended): Place `opencode.json` in each project's root directory. This way, different projects can notify different channels, use different accounts, or subscribe to different events.

**Global**: Place `opencode.json` in OpenCode's global config directory. Check OpenCode's documentation for the exact location on your platform. The global config applies when no project-level config is found.

**What wins?** Project-level config takes precedence over global config. If both exist, the project-level file is used and the global file is ignored entirely (they don't merge).

---

## Channel-by-Channel Setup

Each messaging channel requires some setup in Openclaw before the plugin can send to it. This section walks through each one.

### Telegram

**What you need in Openclaw:**

1. A Telegram bot token (get one from [@BotFather](https://t.me/BotFather) on Telegram)
2. Your Telegram username or chat ID
3. You must have started a conversation with the bot (Telegram bots can't message you first)

**Configure the channel in Openclaw:**

```bash
openclaw channel add telegram --bot-token YOUR_BOT_TOKEN
```

Follow any prompts Openclaw gives you. The exact flags may vary by Openclaw version, so check `openclaw channel add --help` if the above doesn't work.

**Verify the channel works:**

```bash
openclaw message send --channel telegram --target "@yourusername" --message "Hello from Openclaw"
```

You should receive this message in Telegram. If you don't:

- Make sure you've started a conversation with the bot first (open the bot in Telegram and press "Start")
- Double-check the bot token
- Confirm your username is correct (include the `@` prefix)

**opencode.json config:**

```json
["opencode-notify-openclaw", {
  "channel": "telegram",
  "target": "@yourusername"
}]
```

The `target` is your Telegram username with the `@` prefix. You can also use a numeric chat ID if you prefer.

### WhatsApp

**What you need in Openclaw:**

1. A WhatsApp Business API account or Openclaw's WhatsApp integration configured
2. The recipient's phone number in E.164 format (e.g., `+1234567890`)

**Configure the channel in Openclaw:**

```bash
openclaw channel add whatsapp
```

Follow the prompts to authenticate. WhatsApp setup typically involves scanning a QR code or linking a phone number through Openclaw's gateway.

**Verify the channel works:**

```bash
openclaw message send --channel whatsapp --target "+1234567890" --message "Hello from Openclaw"
```

Replace the number with the actual recipient. The message should arrive on WhatsApp.

**Common issue:** The phone number must include the country code with a `+` prefix. `1234567890` won't work. `+1234567890` will.

**opencode.json config:**

```json
["opencode-notify-openclaw", {
  "channel": "whatsapp",
  "target": "+1234567890"
}]
```

### Discord

**What you need in Openclaw:**

1. A Discord webhook URL for the channel you want to post to

**Create a webhook in Discord:**

1. Open Discord and go to the server where you want notifications
2. Right-click the target channel and select "Edit Channel"
3. Go to "Integrations" then "Webhooks"
4. Click "New Webhook", give it a name, and copy the webhook URL

**Configure the channel in Openclaw:**

```bash
openclaw channel add discord --webhook-url "https://discord.com/api/webhooks/..."
```

**Verify the channel works:**

```bash
openclaw message send --channel discord --target "https://discord.com/api/webhooks/your-webhook-url" --message "Hello from Openclaw"
```

The message should appear in the Discord channel.

**opencode.json config:**

```json
["opencode-notify-openclaw", {
  "channel": "discord",
  "target": "https://discord.com/api/webhooks/your-webhook-url"
}]
```

The `target` for Discord is the full webhook URL.

**Note on two-way replies:** Discord webhooks are one-way. If you need two-way replies, you'll need a Discord bot (not just a webhook) configured through Openclaw's gateway. Check Openclaw's docs for bidirectional Discord setup.

### Slack

**What you need in Openclaw:**

1. A Slack workspace with a channel for notifications
2. Either a Slack webhook URL or Openclaw's Slack integration configured

**Configure the channel in Openclaw:**

```bash
openclaw channel add slack
```

Follow the OAuth prompts to connect your Slack workspace.

**Verify the channel works:**

```bash
openclaw message send --channel slack --target "#your-channel" --message "Hello from Openclaw"
```

**opencode.json config:**

```json
["opencode-notify-openclaw", {
  "channel": "slack",
  "target": "#your-channel"
}]
```

The `target` for Slack is typically a channel name prefixed with `#`. Depending on your Openclaw setup, it might also be a user ID, a webhook URL, or a DM target. Check what Openclaw expects with `openclaw channel info slack`.

---

## Two-Way Replies Setup

### What It Does

By default, notifications are one-way: the plugin sends a message to your channel, and that's it. With two-way replies enabled, you can respond to notifications directly from your messaging app. Your reply gets forwarded back into OpenCode.

This is most useful for permission requests. When OpenCode asks "Can I edit this file?", you get a Telegram/WhatsApp/Discord/Slack notification. You reply "yes" or "no" right there, and OpenCode acts on it without you switching back to the terminal.

Free-text replies (anything that isn't a permission keyword) are injected into the most recently active OpenCode session as user input.

### Step 1: Enable in Config

Add `enableReplies: true` to your plugin config in `opencode.json`:

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourusername",
      "enableReplies": true,
      "replyTimeoutMs": 120000
    }]
  ]
}
```

`replyTimeoutMs` controls how long the plugin waits for your reply to a permission request. The default is `120000` (2 minutes). After this timeout, the permission falls through to OpenCode's normal interactive prompt. Set it higher if you tend to be slow checking messages, or lower if you want faster fallback.

### Step 2: Set Up the Openclaw Hook

The two-way bridge works by running a tiny HTTP server on `127.0.0.1`. Openclaw needs to know to forward incoming messages to this server. You do that by adding a `message:received` hook to Openclaw's config.

Open (or create) `~/.openclaw/openclaw.json` and add this under the `"hooks"` section:

```json
{
  "hooks": {
    "message:received": {
      "command": "bash",
      "args": [
        "-c",
        "curl -s -X POST \"http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/reply\" -H \"Content-Type: application/json\" -d \"$(printf '{\"text\": \"%s\"}' \"$MESSAGE_TEXT\")\""
      ]
    }
  }
}
```

Here's what each piece does:

| Part | Purpose |
|------|---------|
| `"command": "bash"` | Runs the hook as a bash command |
| `cat /tmp/opencode-notify-openclaw-*.port` | Reads the port number the bridge server wrote on startup |
| `http://127.0.0.1:$PORT/reply` | The local endpoint the bridge listens on |
| `$MESSAGE_TEXT` | Openclaw injects the reply text into this environment variable |
| `curl -s -X POST ...` | Sends the reply as a JSON POST request to the bridge |

The glob pattern (`*.port`) means it works regardless of the process ID. If multiple OpenCode instances are running, it picks up whichever port file the glob expands to first. For single-instance usage this is fine.

### Step 3: Run the Setup Script

The plugin includes a helper script that walks you through the setup and validates your environment:

```bash
bash scripts/setup-hook.sh
```

If you installed the plugin via npm/bun (not from source), find the script at:

```bash
bash node_modules/opencode-notify-openclaw/scripts/setup-hook.sh
```

**What the script does:**

1. Checks that `openclaw` is on your PATH (exits with an error if not)
2. Prints the full hook configuration you need to add to `~/.openclaw/openclaw.json`
3. Shows how to verify the setup with a manual curl command
4. Lists the reply keywords the bridge recognizes

The script doesn't modify any files. It's purely informational. You still need to manually add the hook to your Openclaw config.

**Expected output on success:**

```
✓ openclaw is installed and available on PATH
```

Followed by the setup instructions. If you see `ERROR: openclaw command not found on PATH`, fix that first.

### Step 4: Verify the Bridge

After completing the config, verify everything works end-to-end.

**1. Start OpenCode with the plugin:**

```bash
opencode
```

Watch the startup output for errors. You should not see any `[notify-openclaw]` error messages. If the plugin loaded and `enableReplies` is true, it started the bridge server silently.

**2. Confirm the port file exists:**

```bash
ls /tmp/opencode-notify-openclaw-*.port
```

You should see one file, something like `/tmp/opencode-notify-openclaw-12345.port`. If no file is found, the bridge server didn't start. Check OpenCode's logs for errors.

**3. Read the port number:**

```bash
cat /tmp/opencode-notify-openclaw-*.port
```

This prints a number (e.g., `54321`). That's the port the bridge is listening on.

**4. Test the health endpoint:**

```bash
curl -s http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/health
```

Expected response:

```json
{"status":"ok"}
```

If you get "Connection refused", the server isn't running. If you get a different error, the port file might be stale from a previous run (see Troubleshooting below).

**5. Send a test reply:**

```bash
curl -s -X POST "http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/reply" \
  -H "Content-Type: application/json" \
  -d '{"text": "test reply"}'
```

Expected response:

```json
{"ok":true}
```

This confirms the bridge is accepting replies. In a real scenario, this reply would be routed to OpenCode as free-text input to the most recent session.

### Port File Details

The bridge server writes its port to `/tmp/opencode-notify-openclaw-{pid}.port` on startup. The `{pid}` is the process ID of the OpenCode instance.

**Lifecycle:**

- Created when OpenCode starts with `enableReplies: true`
- Deleted when OpenCode exits (via `process.on("exit")` and `process.on("SIGTERM")` handlers)
- If OpenCode crashes (SIGKILL), the port file may be left behind as a stale artifact

**Stale port files:** If OpenCode was killed forcefully, the port file sticks around pointing to a port that's no longer listening. The next OpenCode instance creates a new port file with a different PID. The Openclaw hook's glob pattern (`*.port`) may pick up the stale file. To clean up:

```bash
rm /tmp/opencode-notify-openclaw-*.port
```

Then restart OpenCode. A fresh port file will be created.

### Timeout Behavior and Tuning

When a permission notification is sent, the plugin starts a timer. If no reply arrives within `replyTimeoutMs` milliseconds, the pending permission is settled as `null` and falls through to OpenCode's normal prompt.

**Default:** 120000ms (2 minutes)

**Tuning advice:**

| Situation | Recommended value |
|-----------|------------------|
| You check messages frequently | `60000` (1 minute) |
| You're away from your phone often | `300000` (5 minutes) |
| You want near-instant fallback for testing | `10000` (10 seconds) |
| You never want timeout | Don't do this, but `600000` (10 minutes) is the practical max |

The timer runs per permission request. If two permissions fire in sequence, each has its own independent timeout.

**What happens on timeout:** The permission falls through. OpenCode shows its normal interactive prompt as if the plugin wasn't there. No error is logged. This is silent by design.

---

## Verification Checklist

After installation, walk through this checklist to confirm everything is working. Each step builds on the previous one.

**1. Openclaw CLI is working:**

```bash
openclaw --version
openclaw auth status
```

Both commands should succeed. `auth status` should show you're logged in.

**2. Openclaw can reach your channel:**

```bash
openclaw message send --dry-run --channel <channel> --target <target> --message "test"
```

Must exit with code 0.

**3. Plugin loads without errors:**

Start OpenCode and look at the startup output. No lines starting with `[notify-openclaw]` should appear. If they do, something is misconfigured.

**4. Test notification arrives:**

Leave your OpenCode session idle for a few seconds (longer than your `debounceMs` value). You should receive a notification on your configured channel that looks like:

```
🔔 [your-project] OpenCode is waiting for your input
```

**5. (Two-way only) Port file exists:**

```bash
ls /tmp/opencode-notify-openclaw-*.port
```

Should list exactly one file.

**6. (Two-way only) Bridge health check passes:**

```bash
curl -s http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/health
```

Should return `{"status":"ok"}`.

**7. (Two-way only) Reply round-trip works:**

Trigger a permission request in OpenCode (e.g., try to edit a file in a session that requires approval). You should get a notification like:

```
🔐 [your-project] Permission needed: file_edit - Edit config.ts (src/config.ts)
Reply: yes/no/always
```

Reply from your messaging app with `yes`. The permission should resolve in OpenCode without you touching the terminal.

---

## Troubleshooting

### `[notify-openclaw] openclaw not found`

**What it means:** The plugin tried to run `openclaw message send` and the `openclaw` binary wasn't found on the system PATH.

**Fix:**

1. Check if Openclaw is installed at all:
   ```bash
   which openclaw
   ```
   If this returns nothing, Openclaw isn't installed. Install it from [openclaw.com](https://openclaw.com).

2. If Openclaw is installed but not on PATH, find where it lives and add that directory to your PATH. For example, if it's at `/usr/local/bin/openclaw`, make sure `/usr/local/bin` is in your PATH:
   ```bash
   export PATH="/usr/local/bin:$PATH"
   ```
   Add this to your shell profile (`~/.bashrc`, `~/.zshrc`) to make it permanent.

3. Restart OpenCode after fixing the PATH.

**Verify the fix:** Run `openclaw --version` in the same shell where you run OpenCode. If it prints a version, the plugin will find it too.

### `[notify-openclaw] openclaw exited with code 1`

**What it means:** The `openclaw message send` command ran but failed. Exit code 1 is a general error from Openclaw.

**Fix:**

1. Run the exact command the plugin would run, manually:
   ```bash
   openclaw message send --channel <your-channel> --target <your-target> --message "test"
   ```
   Replace the placeholders with your actual values from `opencode.json`.

2. Read the error output. Common causes:
   - Authentication expired (re-run `openclaw auth login`)
   - Channel not configured (run `openclaw channel list` to see what's available)
   - Wrong target format (see the channel-specific sections above)
   - Network issue (check your internet connection)

3. Fix whatever Openclaw reports, then restart OpenCode.

**Verify the fix:** The manual `openclaw message send` command should exit with code 0 and deliver the message.

### No notification received

**What it means:** OpenCode is running, the plugin loaded, but you never get a message on your channel.

**Possible causes and fixes:**

1. **Wrong channel or target:** Double-check the `channel` and `target` values in `opencode.json`. They must exactly match what Openclaw expects. Test with:
   ```bash
   openclaw message send --channel <channel> --target <target> --message "manual test"
   ```

2. **Plugin not in the `plugin` array:** The plugin config must be inside the `"plugin"` array, not at the root of `opencode.json`. Wrong:
   ```json
   {
     "opencode-notify-openclaw": { "channel": "telegram", "target": "@me" }
   }
   ```
   Right:
   ```json
   {
     "plugin": [
       ["opencode-notify-openclaw", { "channel": "telegram", "target": "@me" }]
     ]
   }
   ```

3. **Events filtered out:** If you set the `events` array, make sure it includes the event you're waiting for. To receive idle notifications, `"session.idle"` must be in the list. Omit the `events` field entirely to subscribe to all events.

4. **Debounce too long:** The default idle debounce is 3 seconds. If you set a very high `debounceMs` value, you might not be waiting long enough. Try lowering it to `1000` for testing.

5. **Session not actually idle:** The `session.idle` event only fires when the agent has nothing left to do and is waiting for input. If the agent is still working, no idle notification is sent.

### Notification received but two-way replies not working

**What it means:** You get notifications, but replying from your messaging app does nothing.

**Possible causes and fixes:**

1. **`enableReplies` not set:** Make sure your `opencode.json` includes `"enableReplies": true`.

2. **Openclaw hook not configured:** Check `~/.openclaw/openclaw.json` for the `message:received` hook. If it's missing, add it (see [Step 2](#step-2-set-up-the-openclaw-hook)).

3. **Port file missing:** Check if `/tmp/opencode-notify-openclaw-*.port` exists. If not, the bridge server didn't start. Restart OpenCode and watch for errors.

4. **Stale port file:** If OpenCode crashed previously, an old port file might exist pointing to a dead port. Clean up:
   ```bash
   rm /tmp/opencode-notify-openclaw-*.port
   ```
   Restart OpenCode.

5. **Channel doesn't support replies:** One-way channels like Discord webhooks can't receive incoming messages. You need a bidirectional channel setup in Openclaw for replies to work. Check Openclaw's docs for your channel.

### Port file missing

**What it means:** You enabled `enableReplies: true` but `/tmp/opencode-notify-openclaw-*.port` doesn't exist.

**Possible causes:**

1. **Plugin didn't load:** Check OpenCode's startup output for errors. A config validation failure (missing `channel`, missing `target`, bad JSON) will prevent the plugin from loading, and no server will start.

2. **OpenCode isn't running:** The port file only exists while OpenCode is running. If OpenCode exited, the file is cleaned up automatically.

3. **Permission issue on /tmp:** Extremely rare, but check that your user can write to `/tmp`:
   ```bash
   touch /tmp/test-write && rm /tmp/test-write
   ```

**Fix:** Restart OpenCode with correct config and verify the port file appears.

### Hook not firing

**What it means:** The Openclaw `message:received` hook is configured, but replies from your messaging app don't reach the bridge server.

**Possible causes and fixes:**

1. **Hook syntax error:** Open `~/.openclaw/openclaw.json` and validate the JSON. A misplaced comma, unescaped quote, or missing bracket will silently break the hooks section. Use `jq . ~/.openclaw/openclaw.json` to validate:
   ```bash
   jq . ~/.openclaw/openclaw.json
   ```
   If `jq` reports an error, fix the JSON.

2. **Hook not under the right key:** The hook must be under `"hooks"` > `"message:received"`. Not at the root level, not under a different key name.

3. **Openclaw Gateway not running:** For bidirectional channels, the Openclaw Gateway service must be running to receive inbound messages. Check Openclaw's docs for how to start the gateway.

4. **curl not installed:** The hook command uses `curl`. Verify it's available:
   ```bash
   which curl
   ```
   If missing, install curl for your system.

5. **Port file glob not expanding:** The hook uses `/tmp/opencode-notify-openclaw-*.port` as a glob. If no matching file exists (OpenCode isn't running, or `enableReplies` is false), the `cat` command fails silently and the curl call targets a bad URL.

### `[notify-openclaw] dropping message because another send is already in flight`

**What it means:** The plugin only allows one `openclaw message send` call at a time. A new event arrived while a previous send hadn't finished yet.

**Is this a problem?** Usually not. This happens during rapid bursts of events (e.g., multiple errors in quick succession). The plugin deliberately drops duplicates to avoid flooding your channel.

**If you're seeing it too often:**

- Check if `openclaw message send` is slow. Run it manually and time it. If it takes more than a second or two, the slow CLI is the bottleneck.
- The CLI has a 10-second timeout built into the plugin. If Openclaw hangs, the process is killed after 10 seconds, freeing the lock for the next message.

### Messages truncated

**What it means:** Your notification ends with `... [truncated]`.

**Why:** Messages are capped at 4000 characters. This is intentional. Most messaging platforms have their own limits (Telegram: 4096, WhatsApp: 65536, Discord: 2000, Slack: 40000), and 4000 is a safe common floor.

**Can you change the limit?** Not through config. The limit is hardcoded. If you need longer messages, you'd have to modify the source code (see [Local Development](#local-development-building-from-source)).

### Wrong target format per channel

**Symptoms:** `openclaw exited with code 1` or no message received, and you suspect the target value is wrong.

**Correct formats by channel:**

| Channel | Target Format | Example |
|---------|--------------|---------|
| Telegram | `@username` or numeric chat ID | `@johndoe` or `123456789` |
| WhatsApp | E.164 phone number with `+` prefix | `+14155551234` |
| Discord | Full webhook URL | `https://discord.com/api/webhooks/123/abc` |
| Slack | Channel name with `#` or webhook URL | `#general` |

**How to verify:** Run the Openclaw send command manually with your target value. If it fails, check `openclaw channel info <channel>` for the expected format.

### Plugin not loading

**Symptoms:** OpenCode starts but no notifications are ever sent, and no `[notify-openclaw]` messages appear in the output at all (not even errors).

**Possible causes:**

1. **opencode.json syntax error:** Invalid JSON prevents the entire config from loading. Validate with:
   ```bash
   jq . opencode.json
   ```
   Fix any syntax errors (trailing commas, unquoted keys, etc.).

2. **Wrong plugin array format:** The plugin must be a tuple (two-element array) inside the `"plugin"` array. The first element is the package name as a string, the second is the options object.

   Wrong (object instead of tuple):
   ```json
   { "plugin": { "opencode-notify-openclaw": { "channel": "telegram" } } }
   ```

   Wrong (missing options object):
   ```json
   { "plugin": ["opencode-notify-openclaw"] }
   ```

   Right:
   ```json
   { "plugin": [["opencode-notify-openclaw", { "channel": "telegram", "target": "@me" }]] }
   ```

3. **Package not installed:** The plugin must be in `node_modules`. Run `npm ls opencode-notify-openclaw` or `bun pm ls` to check. If it's not listed, install it (see [Installation Methods](#installation-methods)).

4. **Wrong opencode.json location:** Make sure `opencode.json` is in the directory where you're running OpenCode. A config file in the wrong directory is silently ignored.

5. **Missing required fields:** If `channel` or `target` is missing, the plugin logs a warning and returns empty hooks (no notifications). Check OpenCode's stderr output for `Config validation failed` messages.

---

## Uninstalling

### Remove the Plugin

**1. Remove the package:**

```bash
# npm
npm uninstall opencode-notify-openclaw

# bun
bun remove opencode-notify-openclaw
```

**2. Remove the plugin from opencode.json:**

Open `opencode.json` and delete the `["opencode-notify-openclaw", { ... }]` tuple from the `plugin` array. If it was the only plugin, you can remove the entire `"plugin"` key or leave an empty array:

```json
{
  "plugin": []
}
```

**3. Restart OpenCode** so it stops trying to load the plugin.

### Remove the Openclaw Hook

If you set up two-way replies, clean up the Openclaw hook too.

**1. Edit `~/.openclaw/openclaw.json`** and remove the `"message:received"` entry from the `"hooks"` section.

**2. Clean up stale port files:**

```bash
rm -f /tmp/opencode-notify-openclaw-*.port
```

That's it. The plugin doesn't create any other files, databases, or background services. Once uninstalled and removed from config, it's fully gone.
