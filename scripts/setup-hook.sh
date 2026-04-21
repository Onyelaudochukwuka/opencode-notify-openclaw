#!/usr/bin/env bash
# Copyright (c) 2026 Udochukwuka Onyela
#
# setup-hook.sh — Install or remove the Openclaw reply-forwarding bridge
#
# Usage:
#   ./scripts/setup-hook.sh --channel <name> --target <id>
#   ./scripts/setup-hook.sh --channel <name> --target <id> --dry-run
#   ./scripts/setup-hook.sh --uninstall
#
# What it does:
#   Writes a polling script to ~/.openclaw/opencode-bridge-poll.sh that
#   periodically reads new messages from your Openclaw channel and forwards
#   them to the local bridge server started by opencode-notify-openclaw.
#   Then starts the poller in the background and records its PID.

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers (disabled when not a TTY)
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; RESET=''
fi

info()    { printf "${GREEN}✓${RESET}  %s\n" "$*"; }
warn()    { printf "${YELLOW}!${RESET}  %s\n" "$*"; }
error()   { printf "${RED}✗${RESET}  %s\n" "$*" >&2; }
heading() { printf "\n${BOLD}%s${RESET}\n" "$*"; }
step()    { printf "   %s\n" "$*"; }

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
CHANNEL=""
TARGET=""
DRY_RUN=false
UNINSTALL=false
POLL_INTERVAL=5   # seconds between polls

POLL_SCRIPT="$HOME/.openclaw/opencode-bridge-poll.sh"
PID_FILE="/tmp/opencode-bridge-poll.pid"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --channel)   CHANNEL="$2"; shift 2 ;;
    --target)    TARGET="$2";  shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    --uninstall) UNINSTALL=true; shift ;;
    --interval)  POLL_INTERVAL="$2"; shift 2 ;;
    -h|--help)
      cat <<'HELP'
Usage:
  setup-hook.sh --channel <name> --target <id>   Install the bridge poller
  setup-hook.sh --uninstall                       Remove the bridge poller
  setup-hook.sh --dry-run --channel <n> --target <t>  Preview without changes

Options:
  --channel <name>    Openclaw channel to poll (e.g. telegram, whatsapp, discord)
  --target <id>       Recipient ID on that channel (e.g. @yourhandle, +1234567890)
  --interval <secs>   Poll interval in seconds (default: 5)
  --dry-run           Print what would be done without making changes
  --uninstall         Stop the poller and remove the poll script
  -h, --help          Show this help

Examples:
  ./scripts/setup-hook.sh --channel telegram --target @yourhandle
  ./scripts/setup-hook.sh --channel whatsapp --target +15551234567
  ./scripts/setup-hook.sh --uninstall
HELP
      exit 0
      ;;
    *) error "Unknown argument: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Uninstall path
# ---------------------------------------------------------------------------
if $UNINSTALL; then
  heading "Removing opencode-notify-openclaw bridge poller"

  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      if $DRY_RUN; then
        step "[dry-run] Would kill poller PID $PID"
      else
        kill "$PID" 2>/dev/null && info "Stopped poller (PID $PID)" || warn "Process $PID was not running"
      fi
    else
      warn "Poller PID $PID is not running"
    fi
    if ! $DRY_RUN; then rm -f "$PID_FILE"; fi
  else
    warn "No PID file found at $PID_FILE — poller may not be running"
  fi

  if [ -f "$POLL_SCRIPT" ]; then
    if $DRY_RUN; then
      step "[dry-run] Would remove $POLL_SCRIPT"
    else
      rm -f "$POLL_SCRIPT"
      info "Removed $POLL_SCRIPT"
    fi
  fi

  info "Uninstall complete"
  exit 0
fi

# ---------------------------------------------------------------------------
# Install path — validate arguments
# ---------------------------------------------------------------------------
heading "opencode-notify-openclaw bridge setup"

if [ -z "$CHANNEL" ] || [ -z "$TARGET" ]; then
  # Interactive fallback
  if [ -t 0 ]; then
    printf "Channel (e.g. telegram, whatsapp, discord): "
    read -r CHANNEL
    printf "Target (e.g. @yourhandle, +15551234567): "
    read -r TARGET
  else
    error "--channel and --target are required"
    error "Run with --help for usage"
    exit 1
  fi
fi

if [ -z "$CHANNEL" ] || [ -z "$TARGET" ]; then
  error "Channel and target cannot be empty"
  exit 1
fi

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
heading "Checking prerequisites"

# openclaw
if ! command -v openclaw &>/dev/null; then
  error "openclaw not found on PATH"
  step "Install Openclaw: https://openclaw.com"
  exit 1
fi
OPENCLAW_VERSION=$(openclaw --version 2>&1 | head -1 || echo "unknown")
info "openclaw found ($OPENCLAW_VERSION)"

# jq (optional but recommended)
JQ_AVAILABLE=false
if command -v jq &>/dev/null; then
  JQ_AVAILABLE=true
  info "jq found"
else
  warn "jq not found — message parsing will use basic text extraction"
  step "Install jq for better reliability: https://jqlang.github.io/jq/"
fi

# curl
if ! command -v curl &>/dev/null; then
  error "curl not found on PATH — required to forward messages to the bridge"
  exit 1
fi
info "curl found"

# Gateway health check
if openclaw health &>/dev/null 2>&1; then
  info "Openclaw gateway is running"
else
  warn "Could not reach Openclaw gateway — make sure it is running before starting OpenCode"
  step "Start the gateway: openclaw gateway"
fi

# Verify the channel/target combination works
heading "Verifying channel configuration"
step "Channel: $CHANNEL"
step "Target:  $TARGET"

if openclaw message read --channel "$CHANNEL" --target "$TARGET" --limit 1 &>/dev/null 2>&1; then
  info "Channel read test passed"
else
  warn "Could not read from channel '$CHANNEL' target '$TARGET'"
  warn "The poller will still be installed — verify your channel config in Openclaw"
  step "Test manually: openclaw message read --channel $CHANNEL --target $TARGET --limit 1"
fi

# ---------------------------------------------------------------------------
# Write the polling script
# ---------------------------------------------------------------------------
heading "Writing bridge poller"

# Sanitise TARGET for use in filenames
TARGET_SAFE="${TARGET//[^a-zA-Z0-9_-]/_}"
LAST_ID_FILE="/tmp/openclaw-bridge-last-${CHANNEL}-${TARGET_SAFE}"

POLL_SCRIPT_CONTENT="#!/usr/bin/env bash
# Auto-generated by opencode-notify-openclaw setup-hook.sh
# Polls Openclaw for new messages and forwards them to the local bridge server.
# Remove with: ./scripts/setup-hook.sh --uninstall

CHANNEL=\"${CHANNEL}\"
TARGET=\"${TARGET}\"
POLL_INTERVAL=${POLL_INTERVAL}
LAST_ID_FILE=\"${LAST_ID_FILE}\"
PORT_GLOB=\"/tmp/opencode-notify-openclaw-*.port\"

while true; do
  # Locate the bridge server port file
  PORT_FILE=\$(ls \$PORT_GLOB 2>/dev/null | head -1)
  if [ -z \"\$PORT_FILE\" ]; then
    sleep \"\$POLL_INTERVAL\"
    continue
  fi
  PORT=\$(cat \"\$PORT_FILE\")

  # Read last-seen message ID
  LAST_ID=\"\"
  [ -f \"\$LAST_ID_FILE\" ] && LAST_ID=\$(cat \"\$LAST_ID_FILE\")

  # Fetch new messages from Openclaw
  if [ -n \"\$LAST_ID\" ]; then
    RAW=\$(openclaw message read --channel \"\$CHANNEL\" --target \"\$TARGET\" --json --limit 10 --after \"\$LAST_ID\" 2>/dev/null || true)
  else
    # First run: only fetch the single most recent message to avoid replaying history
    RAW=\$(openclaw message read --channel \"\$CHANNEL\" --target \"\$TARGET\" --json --limit 1 2>/dev/null || true)
    if [ -n \"\$RAW\" ]; then
      # Record the ID without forwarding — we only forward messages received after setup
      if command -v jq &>/dev/null; then
        SEEN_ID=\$(printf '%s' \"\$RAW\" | jq -r 'if type==\"array\" then last.id // empty else .id // empty end' 2>/dev/null || true)
      else
        SEEN_ID=\$(printf '%s' \"\$RAW\" | grep -o '\"id\":\"[^\"]*\"' | tail -1 | cut -d'\"' -f4 || true)
      fi
      [ -n \"\$SEEN_ID\" ] && printf '%s' \"\$SEEN_ID\" > \"\$LAST_ID_FILE\"
    fi
    sleep \"\$POLL_INTERVAL\"
    continue
  fi

  # Forward each new message to the bridge
  if [ -n \"\$RAW\" ] && [ \"\$RAW\" != \"[]\" ] && [ \"\$RAW\" != \"null\" ]; then
    if command -v jq &>/dev/null; then
      # Parse with jq: extract id and text from each message
      printf '%s' \"\$RAW\" | jq -r '.[] | [.id, (.text // .content // \"\")] | @tsv' 2>/dev/null | \
      while IFS=\$'\\t' read -r MSG_ID MSG_TEXT; do
        if [ -n \"\$MSG_TEXT\" ] && [ -n \"\$MSG_ID\" ]; then
          # Escape for JSON
          ESCAPED=\$(printf '%s' \"\$MSG_TEXT\" | sed 's/\\\\/\\\\\\\\/g; s/\"/\\\\\"/g; s/\\t/\\\\t/g')
          curl -s -X POST \"http://127.0.0.1:\$PORT/reply\" \\
            -H 'Content-Type: application/json' \\
            -d \"{\\\"text\\\": \\\"\$ESCAPED\\\"}\" >/dev/null 2>&1 || true
          printf '%s' \"\$MSG_ID\" > \"\$LAST_ID_FILE\"
        fi
      done
    else
      # Fallback: basic grep extraction (less reliable)
      NEW_ID=\$(printf '%s' \"\$RAW\" | grep -o '\"id\":\"[^\"]*\"' | tail -1 | cut -d'\"' -f4 || true)
      MSG_TEXT=\$(printf '%s' \"\$RAW\" | grep -o '\"text\":\"[^\"]*\"' | tail -1 | cut -d'\"' -f4 || true)
      if [ -n \"\$MSG_TEXT\" ] && [ -n \"\$NEW_ID\" ]; then
        ESCAPED=\$(printf '%s' \"\$MSG_TEXT\" | sed 's/\\\\/\\\\\\\\/g; s/\"/\\\\\"/g')
        curl -s -X POST \"http://127.0.0.1:\$PORT/reply\" \\
          -H 'Content-Type: application/json' \\
          -d \"{\\\"text\\\": \\\"\$ESCAPED\\\"}\" >/dev/null 2>&1 || true
        printf '%s' \"\$NEW_ID\" > \"\$LAST_ID_FILE\"
      fi
    fi
  fi

  sleep \"\$POLL_INTERVAL\"
done
"

if $DRY_RUN; then
  step "[dry-run] Would write polling script to: $POLL_SCRIPT"
  step "[dry-run] Poll interval: ${POLL_INTERVAL}s"
  step "[dry-run] Last-ID file: $LAST_ID_FILE"
else
  mkdir -p "$(dirname "$POLL_SCRIPT")"
  printf '%s' "$POLL_SCRIPT_CONTENT" > "$POLL_SCRIPT"
  chmod +x "$POLL_SCRIPT"
  info "Wrote $POLL_SCRIPT"
fi

# ---------------------------------------------------------------------------
# Stop any existing poller before starting a new one
# ---------------------------------------------------------------------------
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    if $DRY_RUN; then
      step "[dry-run] Would stop existing poller (PID $OLD_PID)"
    else
      kill "$OLD_PID" 2>/dev/null || true
      info "Stopped previous poller (PID $OLD_PID)"
    fi
  fi
  if ! $DRY_RUN; then rm -f "$PID_FILE"; fi
fi

# ---------------------------------------------------------------------------
# Start the poller in the background
# ---------------------------------------------------------------------------
heading "Starting bridge poller"

if $DRY_RUN; then
  step "[dry-run] Would start: bash $POLL_SCRIPT &"
  step "[dry-run] Would write PID to: $PID_FILE"
else
  bash "$POLL_SCRIPT" &
  POLLER_PID=$!
  printf '%s' "$POLLER_PID" > "$PID_FILE"
  info "Poller started (PID $POLLER_PID)"
  step "PID file: $PID_FILE"
  step "To stop: kill $POLLER_PID  (or run: ./scripts/setup-hook.sh --uninstall)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
heading "Setup complete"
step "Channel:       $CHANNEL"
step "Target:        $TARGET"
step "Poll interval: ${POLL_INTERVAL}s"
step "Poll script:   $POLL_SCRIPT"
if ! $DRY_RUN; then
  step "Poller PID:    $(cat "$PID_FILE" 2>/dev/null || echo 'unknown')"
fi
printf "\n"
info "The bridge poller is running. When OpenCode starts with enableReplies: true,"
step "replies you send on $CHANNEL will be forwarded to the local bridge server."
printf "\n"
step "To verify the bridge server is running after OpenCode starts:"
step "  ls /tmp/opencode-notify-openclaw-*.port"
step "  curl -s http://127.0.0.1/\$(cat /tmp/opencode-notify-openclaw-*.port)/health"
printf "\n"
step "To uninstall: ./scripts/setup-hook.sh --uninstall"
