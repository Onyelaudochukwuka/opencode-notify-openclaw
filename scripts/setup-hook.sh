#!/usr/bin/env bash
# Copyright (c) 2026 Udochukwuka Onyela

set -e

cat << 'EOF'
================================================================================
  Openclaw message:received Hook Setup Guide
================================================================================

This script provides instructions for configuring the Openclaw message:received
hook to forward replies to the local two-way bridge server.

OVERVIEW
--------
The opencode-notify-openclaw bridge runs a local HTTP server that listens for
replies. You can configure Openclaw to send incoming messages to this server
via the message:received hook.

PREREQUISITES
-------------
EOF

# Check if openclaw is installed
if ! command -v openclaw &> /dev/null; then
  echo "ERROR: openclaw command not found on PATH." >&2
  echo "Install Openclaw first: https://github.com/openclaw/openclaw" >&2
  exit 1
else
  cat << 'EOF'
✓ openclaw is installed and available on PATH

EOF
fi

cat << 'EOF'
PORT FILE LOCATION
------------------
The bridge server writes its port to a temporary file:

  /tmp/opencode-notify-openclaw-*.port

Use the glob pattern to find the port dynamically:

  PORT=$(cat /tmp/opencode-notify-openclaw-*.port)

CURL COMMAND EXAMPLE
--------------------
To send a reply to the bridge server, use:

  curl -s -X POST "http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/reply" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"text": "%s"}' "$MESSAGE_TEXT")"

Replace $MESSAGE_TEXT with the reply text you want to send.

OPENCLAW HOOK CONFIGURATION
----------------------------
Add the following to ~/.openclaw/openclaw.json under the "hooks" section:

  "message:received": {
    "command": "bash",
    "args": [
      "-c",
      "curl -s -X POST \"http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/reply\" -H \"Content-Type: application/json\" -d \"$(printf '{\"text\": \"%s\"}' \"$MESSAGE_TEXT\")\""
    ]
  }

REPLY HINT KEYWORDS
-------------------
The bridge recognizes these keywords in replies:
  - Allow once: yes, y, allow
  - Allow always: always
  - Deny: no, n, deny, reject

VERIFICATION
------------
To test the hook configuration:

  1. Start the bridge server:
     npm start

  2. In another terminal, verify the port file exists:
     ls -la /tmp/opencode-notify-openclaw-*.port

  3. Test the curl command manually:
     curl -s -X POST "http://127.0.0.1:$(cat /tmp/opencode-notify-openclaw-*.port)/reply" \
       -H "Content-Type: application/json" \
       -d '{"text": "test reply"}'

  4. Check the bridge logs for the reply being processed.

================================================================================
EOF

exit 0
