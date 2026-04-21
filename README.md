# opencode-notify-openclaw

OpenCode plugin that sends notifications to any messaging channel via the [Openclaw](https://openclaw.com) CLI.

## What It Does

This plugin hooks into OpenCode's event system and sends plain-text notifications when something needs your attention. It covers five scenarios:

- **Session idle** ... the agent finished and is waiting for input
- **Session error** ... something went wrong
- **Permission asked** ... the agent needs approval before proceeding
- **Permission replied** ... a permission request was resolved
- **Message updated** ... the assistant posted a message that looks like a question

Notifications are one-way by default. With `enableReplies: true`, replies from the channel are forwarded back to OpenCode as permission decisions or session input. Messages are plain text, truncated to 4000 characters.

`session.idle` events are debounced (default: 3 seconds) so rapid-fire idle signals collapse into a single notification. All other events send immediately.

## Requirements

Before installing, make sure you have:

- **Node.js 18+** (or Bun runtime) — [nodejs.org](https://nodejs.org) / [bun.sh](https://bun.sh)
- **OpenCode** installed and configured — [opencode.ai](https://opencode.ai)
- **Openclaw CLI** installed and authenticated — [openclaw.com](https://openclaw.com)
- At least one Openclaw channel configured. Verify with:
  ```bash
  openclaw message send --dry-run --channel <your-channel> --target <your-target> --message "test"
  ```
  This should exit 0 with no errors before you proceed.

## Installation

### Step 1 — Install the plugin

```bash
# With npm
npm install opencode-notify-openclaw

# With bun
bun add opencode-notify-openclaw
```

### Step 2 — Add to your opencode.json

Open (or create) `opencode.json` in your project directory and add the plugin to the `plugin` array:

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourhandle"
    }]
  ]
}
```

**To notify on multiple channels**, add the plugin tuple once per channel:

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "whatsapp",
      "target": "+1234567890"
    }],
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourhandle"
    }]
  ]
}
```

**All configuration options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `channel` | string | ✅ | — | Openclaw channel name (e.g. `telegram`, `whatsapp`, `discord`) |
| `target` | string | ✅ | — | Recipient identifier — format depends on channel |
| `account` | string | | — | Openclaw account ID, for multi-account setups |
| `debounceMs` | number | | `3000` | Milliseconds to debounce `session.idle` events |
| `events` | string[] | | all | Subset of events to notify on (omit to receive all) |

### Step 3 — Restart OpenCode

Restart OpenCode for the plugin to load. You can verify it loaded without errors by checking OpenCode's log output at startup.

### Step 4 — Verify it's working

Trigger a test notification by leaving your OpenCode session idle for a few seconds. You should receive a message on your configured channel.

You can also test your Openclaw setup independently:
```bash
openclaw message send --channel <your-channel> --target <your-target> --message "opencode-notify-openclaw test 🔔"
```

## Troubleshooting

**`[notify-openclaw] openclaw not found`**
The `openclaw` binary is not on your `PATH`. Install Openclaw from [openclaw.com](https://openclaw.com) and ensure it is accessible in your shell.

**No notification received after idle**
1. Check your `channel` and `target` values match what Openclaw expects for your messaging app
2. Run `openclaw message send --dry-run --channel <ch> --target <t> --message test` to validate your credentials
3. Ensure the `opencode-notify-openclaw` entry appears in your `plugin` array (not at the root level)

**`[notify-openclaw] openclaw exited with code 1`**
Openclaw returned an error. Run the `openclaw message send` command manually with the same `--channel` and `--target` to see the full error output.

**`[notify-openclaw] dropping message because another send is already in flight`**
This is normal — the plugin allows only one concurrent send. The dropped message was a duplicate during a rapid burst of events.

**Messages are truncated**
Messages over 4000 characters are automatically truncated. This is by design to stay within messaging app limits.

## Two-Way Replies

When `enableReplies: true`, the plugin starts a local HTTP server and forwards
incoming Openclaw messages back to OpenCode as permission decisions or free-text
session input.

### Prerequisites

- Openclaw Gateway must be running and configured with a bidirectional channel
- The Openclaw `message:received` hook must be set up (see `scripts/setup-hook.sh`)

### Configuration

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourhandle",
      "enableReplies": true,
      "replyTimeoutMs": 120000
    }]
  ]
}
```

### Reply Keywords

When a permission notification arrives, reply with one of these keywords:

| Reply       | Action                    |
|-------------|---------------------------|
| `yes`, `y`, `allow` | Approve once     |
| `always`    | Approve always            |
| `no`, `n`, `deny`, `reject` | Deny     |
| Anything else | Sent as free-text to the most recent session |

Keywords are case-insensitive. Partial matches are not supported, exact match only.

### How It Works

1. The plugin starts a local HTTP server on `127.0.0.1` with a random port
2. The port is written to `/tmp/opencode-notify-openclaw-{pid}.port`
3. Openclaw calls the local server when a `message:received` event fires
4. The plugin parses the reply, resolves the pending permission or injects free text

Run `scripts/setup-hook.sh` for step-by-step Openclaw hook setup instructions.

### Openclaw Hook Setup

Add the following to `~/.openclaw/openclaw.json` under the `"hooks"` section:

```json
"message:received": {
  "command": "bash",
  "args": [
    "-c",
    "curl -s -X POST \"http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/reply\" -H \"Content-Type: application/json\" -d \"$(printf '{\"text\": \"%s\"}' \"$MESSAGE_TEXT\")\""
  ]
}
```

The bridge server writes its port to `/tmp/opencode-notify-openclaw-{pid}.port` on startup. The hook reads this file dynamically so no manual port configuration is needed.

### Limitations

- Replies route to `127.0.0.1` only (never exposed externally)
- Free-text replies go to the most recently active session only
- Timeout defaults to 2 minutes. Unanswered permissions fall through to OpenCode's normal prompt.
- No retry logic. If the reply server is not running, Openclaw's curl hook will fail silently.

## Configuration

Add the plugin to your `opencode.json` as a tuple with options:

```json
{
  "plugin": [
    ["opencode-notify-openclaw", {
      "channel": "telegram",
      "target": "@yourhandle",
      "debounceMs": 5000,
      "events": ["session.idle", "session.error", "permission.asked"],
      "enableReplies": true,
      "replyTimeoutMs": 120000
    }]
  ]
}
```

### Config Options

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `channel` | `string` | Yes | | Openclaw channel name (e.g. `"telegram"`, `"whatsapp"`, `"discord"`, `"slack"`) |
| `target` | `string` | Yes | | Recipient identifier for the channel (handle, phone number, webhook URL, etc.) |
| `account` | `string` | No | | Openclaw account name, if you have multiple accounts configured |
| `debounceMs` | `number` | No | `3000` | Debounce window for `session.idle` events, in milliseconds. Must be > 0. |
| `events` | `string[]` | No | All five events | Which events trigger notifications. Unrecognized values are silently ignored. |
| `enableReplies` | `boolean` | No | `false` | Enable two-way reply bridge. See [Two-Way Replies](#two-way-replies). |
| `replyTimeoutMs` | `number` | No | `120000` | Milliseconds to wait for a reply before timeout. Only used when `enableReplies` is `true`. |

`channel` and `target` are the only required fields. Everything else has sensible defaults.

## Channel Examples

### Telegram

```json
["opencode-notify-openclaw", {
  "channel": "telegram",
  "target": "@yourusername"
}]
```

### WhatsApp

```json
["opencode-notify-openclaw", {
  "channel": "whatsapp",
  "target": "+1234567890"
}]
```

### Discord

```json
["opencode-notify-openclaw", {
  "channel": "discord",
  "target": "https://discord.com/api/webhooks/your-webhook-url"
}]
```

### Slack

```json
["opencode-notify-openclaw", {
  "channel": "slack",
  "target": "#your-channel"
}]
```

The exact `target` format depends on how your Openclaw channel is configured. Check the Openclaw docs for your specific setup.

## Events

| Event | Hook Source | Behavior |
|-------|-----------|----------|
| `session.idle` | `event` (type: `session.idle`) | Debounced. Fires once after the debounce window if no new idle events arrive. |
| `session.error` | `event` (type: `session.error`) | Immediate. Includes the error message (truncated to 200 chars). |
| `permission.asked` | `permission.ask` hook | Immediate. Emitted when the agent requests permission, before the user responds. |
| `permission.replied` | `event` (type: `permission.replied`) | Immediate. Sent after a permission decision is recorded. |
| `message.updated` | `chat.message` hook | Immediate. Synthesized from assistant text parts. Only fires when the text looks like a question or prompt (aggressive heuristic). |

### Notification Formats

```
🔔 [project-id] OpenCode is waiting for your input
⚠️ [project-id] Error: something went wrong
🔐 [project-id] Permission needed: file_edit — Edit config.ts (src/config.ts)
✅ [project-id] Permission resolved: allow
💬 [project-id] OpenCode asks: Which approach would you prefer?
```

### How `message.updated` Filtering Works

Not every assistant message triggers a notification. The plugin extracts text parts from the assistant's response and runs them through a question detector. It looks for:

1. Text ending with `?`
2. Prompt phrases like "please choose", "should I", "would you like", "let me know"
3. Question words (What, Which, How, etc.) at sentence boundaries

Code blocks are stripped before checking, so ternary operators like `a ? b : c` won't cause false positives. The filter errs on the side of notifying.

## Known Limitations

- **One-way by default.** Replies are not supported unless `enableReplies: true` is set. See [Two-Way Replies](#two-way-replies) for setup.
- **Plain text.** No rich formatting, Markdown, or media attachments.
- **No retries.** If the Openclaw CLI call fails, the message is dropped. A warning is written to stderr.
- **No channel validation.** The plugin doesn't verify that your `channel` or `target` values are valid. Errors surface at send time.
- **One send at a time.** If a notification is already in flight, new messages are dropped (not queued). This prevents pile-ups but means rapid non-idle events could be lost.
- **CLI timeout.** Each `openclaw message send` call has a 10-second timeout. If the CLI hangs, the process is killed and a warning is logged.
- **4000-character limit.** Messages longer than 4000 characters are truncated with a `... [truncated]` suffix.
- **Heuristic filtering for `message.updated`.** The question detector uses regex patterns, not semantic analysis. Some false positives and negatives are expected.

## License

MIT
