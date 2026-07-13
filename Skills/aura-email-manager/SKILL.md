---
name: aura-email-manager
description: Aura's email management skill for hello@karima.digital. Runs twice daily (8am + 4pm ET) to triage inbox, draft replies in Karima's voice, and keep her out of her inbox entirely. Handles training period (first 2 weeks), promotional archiving, scheduling logic, and SMS/Telegram notifications.
compatibility: Created for Zo Computer
metadata:
  author: karimadigital.zo.computer
---

# Aura Email Manager

Automated twice-daily inbox management for hello@karima.digital.

## Schedule
- 8:00 AM ET — morning sweep
- 4:00 PM ET — afternoon sweep

## State File
All state lives at `/home/workspace/.aura-email-state.json`:
- `first_run_date`: ISO date string of first ever run (set on first run if null)
- `whitelisted_senders`: array of email addresses to never archive
- `approved_archiving`: boolean — true once Karima approves auto-archiving
- `last_run_at`: ISO timestamp of last completed run

## Voice Guide
All drafts must follow `/home/workspace/karima-voice-guide.md`. Read it before writing any draft.

## Workflow

### STEP 1: DETERMINE WINDOW
Read `/home/workspace/.aura-email-state.json`.
- If `first_run_date` is null → FIRST RUN. Set window to last 30 days. Set `first_run_date` to today's date.
- Otherwise → window is last 12 hours.

Training period: compare `first_run_date` to today. If < 14 days → still in training period.

### STEP 2: SCAN
Use `use_app_gmail` (`gmail-search-emails`) to fetch all emails for `hello@karima.digital` within the window.

### STEP 3: CATEGORIZE
- **Real People**: actual humans — questions, business inquiries, scheduling, partnership requests, client replies
- **Promotional**: marketing, newsletters, sales pitches, cold outreach, subscription content
- **Updates**: notifications, alerts, platform digests, automated system messages

### STEP 4: REAL PEOPLE DRAFTS
For each Real People email:
1. Fetch full thread via `gmail-get-thread`
2. Read `/home/workspace/karima-voice-guide.md`
3. Write reply in Karima's voice — warm, direct, no fluff, no corporate speak
4. **Scheduling trigger**: if body contains "meeting", "call", "chat", "schedule", "availability", "calendar", "time", "coffee", "connect", or "catch up" → ALWAYS include: "Here's my calendar to find a time that works: https://calendar.app.google/Le2dvwdV6ZxGdp9YA"
5. Create draft via `gmail-create-draft` with `inReplyTo` set to the thread's Message-ID. NEVER send — drafts only.
6. If they propose a specific date/time → ALSO create a Google Calendar event via `use_app_google_calendar`

### STEP 5: PROMOTIONAL & UPDATES

**Training period (first 14 days):**
- Do NOT archive
- Send Telegram (`send_telegram_message`):
  ```
  🗂️ Aura here. I would have archived these — let me know if any should stay:
  • [sender] — [subject]
  • [sender] — [subject]
  Reply KEEP [sender] to whitelist, or APPROVE to start auto-archiving.
  ```

**After training period (or `approved_archiving` is true):**
- Archive all Promotional + Updates via `gmail-label-email` or archive action
- New/unfamiliar sender? Flag in Telegram first before archiving

### STEP 6: SMS
Use `send_sms_to_user` to text Karima.

**If drafts ready:**
```
You have [X] drafts ready.

Reply needed: [Name] ([one-line context]), [Name] ([one-line context]).

Check your drafts.
```

**If no Real People emails:**
```
Inbox clear. No replies needed right now ✨
```

Keep it under 5 seconds to read. No promotional counts. No noise.

### STEP 7: UPDATE STATE
Write `/home/workspace/.aura-email-state.json` with `last_run_at` = current ISO timestamp.

## Hard Rules
- NEVER send email. Drafts only.
- ALWAYS set `inReplyTo` so drafts thread correctly.
- ALWAYS include booking link when scheduling keywords present.
- SMS = Real People notifications only.
- Telegram = promotional/training period flags only.
