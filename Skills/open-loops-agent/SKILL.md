---
name: open-loops-agent
description: Manages Karima's Open Loops task board. Adds tasks to triage, reads the board, closes loops, and moves tasks between statuses. Works via text/SMS and chat.
compatibility: Created for Zo Computer
metadata:
  author: karimadigital.zo.computer
  created: "2026-07-05"
---

# Open Loops Agent

This skill lets Zo manage Karima's Open Loops task board at https://open-loops-zo-karimadigital.zocomputer.io.

## What it does

- **Add to triage** — takes raw input (text, SMS, voice note context) and drops it into the Triage bucket for Karima to review
- **Read the board** — returns current tasks by vertical or status bucket
- **Close a loop** — marks a task done
- **Move a task** — changes a task's status bucket
- **Send SMS confirmation** — texts Karima after any write action

## API base

```
https://open-loops-zo-karimadigital.zocomputer.io
```

## Endpoints

### Read full board state
```
GET /api/open-loops
```
Returns the full state JSON: groups (with tasks), triage, archived, etc.

### Mark a task done
```
POST /api/done
Content-Type: application/json

{
  "title": "Follow up with Aaron about contract"
}
```
You can also send `{ "taskId": "..." }` when you already know the id. Returns `{ ok: true, archived: { ... } }`. If multiple tasks match the title, it returns a 409 with the matching titles so the agent can ask Karima which one she meant.

### Add a task to Triage (agent lane)
```
POST /api/triage
Content-Type: application/json

{
  "title": "Follow up with Aaron about contract",
  "note": "He said he'd send it by Friday",
  "groupName": "Karima Digital Company",
  "dueDate": "2026-07-10",
  "tags": []
}
```
Only `title` is required. `groupName` should match one of the four verticals exactly (see below). Returns `{ ok: true, task: { id, title, ... } }`.

### Update full board state
```
PUT /api/open-loops
Content-Type: application/json
```
Send a partial PersistedState to merge. Use for closing loops, moving tasks, or batch updates.

## The four verticals (groupName values)

- `Karima Digital Company` — client delivery, revenue, client comms
- `KDC - Brand` — internal ops, website, warm growth
- `Claudisha Jackson` — content engine, planning, distribution
- `AI Power Lab` — community, domain, email systems

## Status buckets

- `triage` — agent's lane, unreviewed input
- `today` — must happen today
- `this-week` — on deck this week
- `backlog` — not urgent, not forgotten
- `waiting` — on hold; needs a scheduled date (show as "On Hold" in UI)

## How to add tasks from SMS/text

When Karima texts something like "add: follow up with Linda about VIP day" or just sends a raw task description, do this:

1. Parse the title from her message
2. Infer `groupName` from context (when unclear, omit it — leave blank so she can triage it herself)
3. POST to `/api/triage`
4. Text her back: "Added to Triage: [title]" via `send_sms_to_user`

## How to close a loop

1. POST to `/api/done` with either `title` or `taskId`
2. If the API returns one clear match, it archives the task into Done
3. If the API returns multiple matches, ask Karima which one she means
4. SMS confirmation

## Example agent instructions (for Zo scheduled/trigger agent)

```
You are Karima's Open Loops board agent.

When given a message from Karima:
- If it contains "add:", "loop:", or reads like a task description, POST it to triage:
  POST https://open-loops-zo-karimadigital.zocomputer.io/api/triage
  Body: { "title": "<task>", "groupName": "<best guess or omit>", "note": "<any context>" }

- If it contains "done:", "close:", or "mark done:", POST to https://open-loops-zo-karimadigital.zocomputer.io/api/done with { "title": "<task>" }.
- If `/api/done` returns multiple matches, ask a short follow-up question instead of guessing.

- If it says "what's on my board?" or "show me today's tasks", GET the board and summarize.

After every write, text Karima a one-line confirmation via send_sms_to_user.

Board API: https://open-loops-zo-karimadigital.zocomputer.io
```
