# Opportunities — Zo-native system spec

**Status:** Handoff spec. Standalone, giveable. Nothing personal hard-coded.
**Supersedes:** the Mac "Office" version of this design (FastAPI + launchd + `file_work.py`). Everything that existed to fight a Mac is removed. See §What's gone.
**Goal it serves:** land paid work monetizable within 30 days. Not pipeline volume. See `INTAKE.md`.

---

## 1. Architecture

One Zo Site is the whole system. Bun + Hono server, React SPA, one SQLite store.

- **Store:** `bun:sqlite` at `data/opportunities.db`. Bun has SQLite built in, zero deps. Four record types: **Opportunity, Criteria, Draft, Run**.
- **Service layer:** one module owns the schema, migrations, and *every mutation* — validation, field ownership, deduplication, audit history. No agent edits the DB directly.
- **Two writers, one code path:**
  - The **dashboard** calls the service through `/api/opportunities*` routes in `server.ts`.
  - The **agents** call the *same routes* over authenticated HTTP (bearer `OPP_API_TOKEN`). Same enforcement point.
- **Read path:** the SPA reads `GET /api/state` and renders the Opportunities tab from it.
- **Run record:** every scheduled run writes a durable Run row at start and end, independent of any notification.

### What's gone (was Mac-only)

launchd plists and `.sh` wrappers; headless `claude -p` harness; `RunAtLoad` sleep/wake catch-up; success-stamp files and same-day guards; the `file_work.py` CLI as the agent path; FastAPI/uvicorn; the "resurrect the Telegram bot" note; Notion. Zo is always-on in the cloud, scheduled agents *are* the model run, and Telegram/SMS/email are native. The one real thing left to test: a scheduled agent reaching the published Site's API with its token and writing a row. A 20-minute check.

---

## 2. Agents and triggers

**Three agents by responsibility. Two scheduled. One on demand.**

| Agent | Runs | Trigger | Owns |
|---|---|---|---|
| **Finder** | Weekly | rrule automation | Discovery fields; new Opportunity rows |
| **Checker** | Daily | rrule automation | Health, Health reason, Last checked/seen-open |
| **Drafter** | On demand | Text command or dashboard button | Draft records and draft linkage |

Do **not** split the five hunters into five agents. One Finder runs all hunters in a single run (fanning out internally via `/zo/ask` children when the environment supports it; sequential must produce the same result). Five schedules would be five things the new user has to wire — exactly the friction we're avoiding.

### Triggers, three kinds

- **Scheduled (rrule):** Finder weekly, Checker daily. The Checker's incremental cadence (§7) lives *inside* the daily run, not as separate schedules.
- **Inbound message (a Rule):** `draft: [opportunity]` fires the Drafter; `pass: [opportunity]` archives; `submitted: [opportunity]` marks submitted. Same shape as existing Open Loops text commands.
- **Manual (dashboard → API):** a "Draft this" button on a card kicks the Drafter for that one row.

Notifications (SMS / Telegram / email) are **outputs, not triggers**. Native, no bot.

**Optional phase-2 triggers:** an inbound-email watcher (Gmail is native) that catches speaking invites and files them as opportunities — a sixth hunter the Mac version couldn't do cheaply.

---

## 3. The record — Opportunity

SQLite columns. Ownership in §5.

| Field | Notes |
|---|---|
| Opportunity | Title |
| Organizer | Who runs it |
| Opportunity type | Paid speaking · Teaching/class · Training/RFP · Partnership/Sponsorship · Award/Recognition · **Shot (warm-adjacent)** |
| Format | Keynote · Workshop · Panel · Fireside · Podcast · Class · Contract · Program · Nomination · Other |
| Opportunity URL | The event/program page |
| Application URL | Where you actually apply/nominate |
| Door type | Application · Nomination · CFP · Booking · Partnership program · **Warm-adjacent approach** |
| Evidence URL | Page fetched *this run* proving it's open |
| Audience/industry | Which room/vertical |
| Location | City/region or "Virtual" |
| Virtual/in-person | enum |
| Pays? | Paid · Fee + travel · Rev-share/affiliate · Authority/visibility · Exposure only · Unknown |
| Compensation | Free text; concrete only if documented |
| Cost to apply or participate | Guards against pay-to-play |
| Deadline | **Date only — never "Rolling"** |
| Deadline type | Fixed · Rolling · Not announced |
| Deadline note | e.g. "monthly on the 15th" |
| Event/start date | Kept separate from the deadline |
| Cycle/year | e.g. "2026" — part of the dedup key |
| **Time to money** | Est. days from apply to cash. The 30-day lens. See §8. |
| **Revenue path** | Which offer this feeds (VIP Day, Lab, workshop, speaking fee). See §8. |
| **Warm link** | Person/affiliation bridging you to this. Required for Shot; optional otherwise. See §6. |
| **Authority basis** | The proof you approach from. Required for Shot. See §6. |
| Why it fits | One line, specific |
| Status | Owned by the user |
| Health | Owned by Checker |
| Health reason | Plain language, required for any non-Verified state |
| First seen / Last checked / Last seen open | Timestamps |
| Canonical key | Dedup (§4) |
| Draft ID | FK → Draft |
| Created / Updated | Timestamps |

**Criteria, Draft, Run** are the other three records. Criteria holds the profile (from `INTAKE.md`). Draft holds one dated draft per attempt, linked to its Opportunity, recording the source Application URL. Run holds run history (§9).

---

## 4. Deduplication

Never dedupe on raw name or raw URL alone.

```
canonical_key = normalized(organizer) + normalized(opportunity) + cycle/year
```

Match order: (1) canonicalized Application URL, tracking params stripped; (2) canonicalized Opportunity URL; (3) organizer + opportunity + cycle/year; (4) fuzzy → flagged for review, not auto-merged. If Finder rediscovers a row with *better* info, it updates safe discovery fields only — never Status/Health.

---

## 5. Ownership (enforced in the service)

| Actor | May change |
|---|---|
| Finder | Discovery fields; new rows |
| Checker | Health, Health reason, Last checked/seen-open, newly verified facts |
| Drafter | Draft records and linkage |
| User / dashboard | Status and all final pipeline decisions |

Finder and Checker **must never overwrite a Status the user set.** The store rejects it. Checker's job precisely: *suppress stale, expired, and dead opportunities from active views without deleting records or changing user-owned Status.*

---

## 6. The five hunters + the shot tier

Each enabled opportunity type is one hunter, parameterized by saved Criteria (industries, location weighting, booking angle, standing AI/founder territory).

- **Stages** — paid speaking: CFPs (Sessionize, PaperCall), summits, panels, podcast guest spots (Paid only if compensation is documented). Sweeps industry verticals + AI/founder/creator rooms.
- **Classrooms** — teaching: libraries, community colleges, continuing-ed, universities, SBDC/SCORE/chamber workshops. Location-weighted.
- **Contracts** — paid training & workshop RFPs; procurement boards.
- **Partnerships** — ambassador/affiliate/creator programs and sponsored content with an apply-to-join door.
- **Recognition** — open award nominations and "top women in AI/marketing"-type lists.

### The shot (warm-adjacent approach) — a gated sixth tier

Cold outreach stays banned. This is not that. It exists because for a Manifestor (4/1 line), *initiating* is on-strategy — approaching first isn't the problem, approaching **cold** is. A 4/1 wins through the network (the 4) from real authority (the 1). So a "shot" is an approach with a bridge and standing, not a stranger asking to be picked.

**An approach qualifies as a Shot — not cold outreach — only when the agent can name all four:**

1. **A bridge.** A shared connection, a community you're both in, an alum/faculty tie, or they've engaged with your work. A real thread, even a thin one.
2. **An authority hook.** You approach from proof (published author, community, named credibility), informing them of something they need — not asking for a shot.
3. **A named person or real role.** A department chair, program director, continuing-ed coordinator. Not a generic `info@` inbox.
4. **A value-first opening.** Leads with why it's relevant to *them* and their audience.

If the agent can't fill all four, it's cold. It stays out.

**Two guardrails so it never sprawls into spray-and-pray:**

- **Gated by size.** Shots are reserved for big targets only: university teaching, a marquee keynote, a named program. Never small gigs. That matches how a Manifestor spends initiating energy — bursts, on things that matter.
- **Bridge and authority are required fields.** For a normal application the agent records the door URL. For a Shot it must record *who the bridge is* (`Warm link`) and *what the authority basis is* (`Authority basis`) before it can surface the row. No hand-waving.

This tier depends entirely on the warm-network input (`brain/network.md`, `brain/affiliations.md` in `INTAKE.md`). No relationship graph means no findable bridge, which means the system correctly won't surface a Shot. That's the safety, not a bug.

**Booking angle** (drives phrasings): outcome-for-their-industry — (1) AI-powered marketing for [industry], (2) AI for [industry] broadly, (3) marketing/growth for [industry]. Founder story is a secondary keynote flavor, not the lead search term.

---

## 7. Checker state machine (deterministic Health)

1. **Link dead** — confirmed missing/error *after retry*.
2. **Expired** — deadline passed, or page says closed.
3. **Changed** — material facts changed; needs review.
4. **Expiring soon** — a Fixed deadline within 14 days.
5. **Verified** — door accessible and explicitly open.
6. **Unclear** — couldn't establish open/closed.
7. **Unchecked** — never evaluated.

A CAPTCHA, JavaScript-only form, login wall, or automation block is **Unclear, not Link dead.** Every non-Verified state carries a plain-language Health reason.

**Incremental cadence** (not "fetch every live row daily"): deadline ≤14 days → daily; rolling → weekly; deadline >30 days → weekly; Changed/Unclear → retry next day; Submitted → weekly unless a date nears; and always **immediately before drafting.**

**Zo add:** because Calendar and Calendly are native, the Checker also flags **date conflicts** against the user's real availability, so a booking application never surfaces for a slot they can't deliver.

---

## 8. The 30-day money lens (what makes this serious)

Two fields turn a "found door" into "money I can make this month," and the Finder must populate both:

- **Time to money** — estimated days from apply to cash, using deadline + decision timeline + event date + payment terms. A $5k keynote in three weeks beats a $20k contract closing next quarter. The dashboard's "Apply next" view sorts by this, not by face compensation.
- **Revenue path** — which offer in `brain/offer-ladder.md` this opportunity feeds. A podcast only scores if it feeds the book or the high-ticket offer. Opportunities are ranked by the money they can *produce*, not their sticker comp.

The Finder never invents compensation or timelines. Unknown is a valid value and is labeled as such. These two fields feed the composite **Opportunity score** that ranks "Apply next" (see §9, Loop engineering).

---

## 9. Finder contract, Run reporting, Drafter contract

**Finder:** one hunter per enabled type. No quota. Each returns **0–6 qualified opportunities; zero is valid.** A normal weekly run inserts no more than 15–20 new rows. Every accepted result needs: an open door, relevance to a saved angle, an identifiable organizer, an open/rolling/upcoming window, honest compensation, evidence fetched *this run*, and no pay-to-play/vanity/predatory signals. Shots additionally need all four §6 gates filled.

**Run record** (durable, every run): start/finish, run type, hunters attempted, new/duplicates/updated/rejected/expired-changed counts, per-agent errors, overall result. Outcomes: **Succeeded · Partial · Failed · No finds.** One hunter failing → Partial, not Failed. Zero qualified finds → No finds, never a technical failure.

**Drafter** (one opportunity at a time): reads the exact application questions and captures word/char limits; reads the voice, positioning, offer, bio, and proof-bank files (`brain/`); drafts question-by-question within limits; flags missing facts instead of inventing them; saves a dated draft linked to the opportunity; never invents results/credentials/clients/metrics; never presses submit. For an email-to-organizer, it prepares a real **Gmail draft on the thread** (native) rather than pasting text. If a form needs login or can't be read safely, it asks the user to paste/export the questions. For a **Shot**, the draft leads with the bridge and the authority basis, and still never sends.

**Proof bank:** `brain/proof-bank.md` is the curated list of verified, safe-to-claim facts. Voice files govern *how it sounds*; the proof bank governs *what factual claims are allowed*. This is the single biggest lever on whether a draft lands (see `INTAKE.md`).

### Loop engineering — the Drafter self-scores and revises

The Drafter never hands over a first pass. It runs a bounded refinement loop:

**Draft → self-score against the rubric → revise if below bar → re-score → stop.** Capped at **2–3 passes** so it can never spin. The final score and per-dimension notes are saved on the Draft record and shown on the card, so the user sees which drafts are strong before opening them.

**Rubric** (each dimension scored, with two hard-fail gates):

| Dimension | What it checks | Fail behavior |
|---|---|---|
| **Voice fidelity** | Obeys `brain/voice-dna.md`. Em dashes, banned phrases, "most people," talking down. | **Hard fail** → forced rewrite |
| **Proof compliance** | Every factual claim traces to `brain/proof-bank.md`. | **Hard fail** → forced rewrite; nothing invented ships |
| **Answers the question** | Responds to what was actually asked, within word/char limits. | Score down |
| **Fit specificity** | The "why me" is specific to *them*, not filler. | Score down |
| **Shot framing** (Shots only) | Leads with the named bridge and authority basis per the §6 gate. | Score down |

Rules that keep the loop honest:

- **The score never auto-decides anything.** It ranks and flags. A human still approves every send. Same invariant as the rest of the system.
- A draft that **can't clear the bar** after its passes is saved and flagged **"needs your eyes"** with the reason, rather than quietly shipping a weak draft or faking a high number.
- The two hard-fail gates (voice, proof) are non-negotiable: a draft that trips either is rewritten regardless of how well it scores elsewhere.

**Opportunity score** (distinct from draft quality): each find carries a composite rank = **Time to money × Revenue path × fit**, so the "Apply next" view surfaces real 30-day money first, not the biggest sticker number. Owned by the Finder, recalculated by the Checker when facts change.

---

## 10. Dashboard (Opportunities tab)

Views: **Inbox** (to review + healthy) · **Apply next** (by Opportunity score) · **Shots** (warm-adjacent, showing bridge + authority) · **Submitted** · **Won** · **Needs attention** (Changed / Unclear / Expiring soon / drafts flagged "needs your eyes") · **Archive** (Passed / Expired / Link dead).

Filters: type · industry · compensation · location · format · deadline · health · revenue path.

Each card shows its **verification evidence and Health reason**, not just a colored label. Cards with a draft show the **draft score and any "needs your eyes" flag**, so the user knows which drafts are strong at a glance. Shot cards additionally show the named bridge and authority basis, so the user can approve or kill the approach at a glance.

---

## 11. Invariants

1. **Open-door only** (Manifestor). Every find has a real door. The one exception is a **Shot**, which substitutes a named bridge + authority basis for a public door and requires explicit user approval before any contact.
2. **Never submits.** A human sends.
3. **One store, one service layer.** All writes go through the service.
4. **Live evidence** for every find and health check.
5. Checker annotates Health only; never overrides Status.
6. Drafter obeys limits and the proof bank; never invents facts.
7. **Paid-first,** never invented; authority-only labeled honestly.
8. Some links go stale between runs; Checker shrinks the problem, doesn't erase it.
9. **Personal content is isolated** to `brain/` and the Criteria record, so the system ships blank and depersonalizes cleanly for handoff.

---

## 12. Scheduling

Two Zo Automations (`create_agent`, rrule):

- **Finder — weekly.** e.g. Mondays 6:00 AM ET.
- **Checker — daily.** e.g. 7:00 AM ET, running the incremental cadence in §7.

No launchd, no wrappers, no catch-up logic, no success stamps. The automation carries its own run history; the Run table is the durable record. **One capability probe before trusting it hands-off:** confirm a scheduled agent can reach the published Site's `/api/opportunities*` with `OPP_API_TOKEN` and write a row. Everything else the Mac probe worried about (network, sleep, RunAtLoad, expired local auth) doesn't exist here.

---

## 13. Build order

1. Schema + ownership rules.
2. `bun:sqlite` store + migrations + `/api/opportunities*` routes (the single, bearer-auth'd write path).
3. Opportunities tab (read + Status/actions).
4. **Finder** with quality gates, canonical dedup, the five hunters + Shot gate, and the Time-to-money / Revenue-path fields — weekly automation.
5. **Checker** + Health state machine + calendar-conflict flag — daily automation.
6. **Drafter** on demand + `brain/proof-bank.md` + Gmail-draft handoff + the loop-engineering rubric (voice/proof hard-fail gates, 2–3 pass cap, score saved on the Draft).
7. Run-history view + native notifications.
8. Text-command rules + capability probe.
9. First-run interview wired to empty-Criteria state (the depersonalization unlock).

Steps 1–4 give a working Finder writing into a dashboard you can act on. 5–6, 7–8, and 9 follow.

---

## 14. Acceptance criteria

Identical findings never duplicate · a hunter can return zero without failing · partial runs preserve completed work · every inserted row has a real door (or, for a Shot, a filled bridge + authority) and current evidence · Checker never changes user Status · blocked pages are never falsely labeled dead · Health changes carry explanations · drafts follow limits and never invent facts · every draft carries a score and no draft ships past the voice/proof hard-fail gates · a draft that can't clear the bar is flagged, never silently sent · the scoring loop is bounded (never exceeds its pass cap) · **no automated submission action exists anywhere** · Shots never surface without all four gates filled · scheduled runs succeed from the real headless environment · failed runs stay visible and never get a false success stamp.
