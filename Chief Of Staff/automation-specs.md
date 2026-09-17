# Chief of Staff automation specs

These are the automations Aura should run in Zo for the chief-of-staff system.

## 1) Morning digest

Schedule: weekdays at 7:30 AM America/New_York

Purpose: reinforce the Rich & Regulated page, identify the first send, keep the board tied to revenue and real follow-up.

Inputs:

- Rich & Regulated daily page
- Open Loops board
- Google Calendar for today
- Gmail for unresolved threads that matter
- recent meeting repo items that created open commitments

Flow:

1. Read the active Rich & Regulated page.
2. Read Open Loops.
3. Read today's calendar.
4. Read unresolved business email threads.
5. Ask for energy level: low, steady, or high.
6. Return:
   - short checklist
   - required outcome
   - first send
   - five qualified contacts or the warm path to them
   - one direct sales or follow-up move that outranks more preparation
   - parking lot items
7. If SMS would exceed roughly 10 lines, send:
   - SMS summary
   - email with full briefing

SMS shape:

- 6 to 10 lines max
- light emoji
- concise

## 2) Meeting intake and research

Trigger: new calendar event created or materially updated

Purpose: research meaningful meetings early so Karima is prepared before the day gets noisy.

Filter for meaningful meetings:

- not all-day
- not personal reminder blocks
- has at least one external attendee, or a title that implies sales, client, partnership, workshop, org, speaking, or press

Research steps:

1. Read event title, description, attendees, links, and date.
2. Search for prior calendar history with attendee names.
3. Search Gmail for prior threads with attendee emails.
4. Search meeting repo / transcript repo for prior notes.
5. Research attendee and organization.
6. Save a prep note artifact.
7. Create or update linked Open Loops follow-ups if unresolved promises already exist.

Required outputs:

- prep summary stored in a durable file or note
- short SMS only if the meeting is soon or materially important

Recommended artifact path:

`file 'Chief Of Staff/meeting-prep/'`

## 3) Pre-meeting reminder

Trigger: time-based off calendar event

Timing:

- 30 minutes before important or unfamiliar meetings
- 10 to 15 minutes before routine meetings

Message contents:

- who it is with
- desired outcome
- 2 to 3 talking points
- unresolved commitment
- link or path to the fuller prep note

## 4) Post-meeting capture and draft

Trigger:

- meeting ends
- then wait for meeting repo / transcript availability

Delay:

- first check 10 minutes after scheduled end
- retry until transcript or recap appears, with a sensible stop window

Purpose: convert spoken promises into immediate follow-up artifacts and board actions.

Flow:

1. Identify the meeting that just ended.
2. Fetch meeting repo content.
3. Extract:
   - decisions
   - promises Karima made
   - action items
   - owners
   - dates
   - questions still open
4. Upsert matching Open Loops items.
5. Draft promised assets immediately:
   - email
   - proposal
   - replay
   - thank-you
   - invitation
6. Ask for approval only where the approval boundary requires it.
7. Send SMS summary with count of actions and what is draft-ready.

## 5) Evening reset

Schedule: weekdays at 9:30 PM America/New_York

Purpose: record what happened, capture one content seed, and lock tomorrow's first move.

Flow:

1. Read changes across Open Loops, calendar, and key email threads.
2. Ask what moved and what is still stuck.
3. Record one concrete content seed from the day's work.
4. Identify tomorrow's first move.
5. Keep it reflective, not judgmental.

## Cross-agent rules

- Open Loops is the shared execution memory.
- Meeting intake may create prep notes and unresolved-follow-up loops.
- Post-meeting capture may create loops and drafts.
- Morning and evening routines should read those loops, not recreate them.
- Agents can trigger each other by leaving machine-readable artifacts in Open Loops and the meeting-prep folder.

## Communication rule

If a digest is longer than about 10 SMS lines, send both:

- a short SMS
- a full email

## Required future Zo wiring

To make this fully live in Zo, each automation still needs:

- its actual Zo agent created
- its schedule or trigger set
- the exact target for the Rich & Regulated page
- the exact meeting repo lookup path or Notion query
- the outbound channel bindings for SMS and email
