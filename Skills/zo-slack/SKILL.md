---
name: zo-slack
description: Full bidirectional Slack integration - send messages to Slack and receive/respond to messages from Slack via mentions or DMs
metadata:
  author: karimadigital.zo.computer
allowed-tools: Bash, Read, Edit
---

# Slack Integration Skill

This skill enables full two-way messaging between Zo and Slack.

## Setup

### 1. Create Slack App
- Go to https://api.slack.com/apps
- Create a new app ("From scratch")
- Add OAuth scopes:
  - `chat:write`, `channels:read`, `groups:read`, `im:read`, `im:write`, `mpim:read`
  - `app_mentions:read`, `channels:history`, `groups:history`
- Install to workspace → copy Bot Token (starts with `xoxb-`)

### 2. Add Secrets
Add to [Settings > Advanced](/?t=settings&s=advanced):
- `SLACK_BOT_TOKEN`: Your xoxb-... token

### 3. Event Subscriptions (for incoming messages)
- Enable "Event Subscriptions" in Slack app
- Subscribe to: `message.channels`, `message.groups`, `message.im`, `app_mention`
- Request URL: `https://karimadigital.zo.space/api/slack-events`
- I'll create this endpoint automatically

## Usage

### Send a message to a channel:
```
slack send "#general" "Hello team!"
```

### Send a DM to a user:
```
slack dm "@username" "Hey, check this out"
```

### List channels:
```
slack channels
```

### Reply to a thread:
```
slack thread "CHANNEL_ID" "TS_TIMESTAMP" "Here's my reply"
```

## Commands

- `slack send <channel> <message>` - Send message to channel
- `slack dm <user> <message>` - Send DM to user
- `slack channels` - List available channels
- `slack chat <channel-id> <message>` - Send using channel ID
