# Opportunities — a Zo-native opportunity pipeline you can hand off

**What this is:** a self-contained system that hunts for paid opportunities where your *buyers* gather, verifies its own finds, and drafts applications on request. Three agents, a dashboard, one store. Built to run entirely on a Zo account, with nothing personal hard-coded so you can pass it to someone else.

**The goal it's tuned for:** not "build a nice pipeline." Land paid work you can monetize in the next 30 days. Every design choice below serves that. See `INTAKE.md` for why the inputs matter more than the search.

---

## Status: built and live (Karima's instance)

The system is running. Dashboard: https://opportunities-zo-karimadigital.zo.computer (private, owner-only). SQLite store, service layer, API, dashboard, three agents, and text commands are all wired and tested. The token is provisioned and the automations are scheduled. See `AGENTS.md` for the live technical state.

**The one thing left to arm it:** the first-run interview. The `brain/` files are still templates. Until they're filled, the Finder runs on seeded defaults (it works, just less sharp) and the Drafter has no proof bank to draw from. Answering `INTAKE.md` is what turns this from "running" into "landing you work."

Everything below is written for the *next person* who installs it. For Karima's own copy, the install is already done.

---

## How it works in one paragraph

A **Finder** runs on a weekly schedule and sweeps five kinds of opportunity (plus a gated "shot" tier for big warm-adjacent targets). A **Checker** runs daily and re-verifies live links so nothing stale reaches you. A **Drafter** runs on demand — from a dashboard button or a text — and writes application answers in your voice, using only verified facts. Everything lands in one SQLite store behind one service layer. You are the only one who changes a pipeline decision or hits submit. Nothing auto-sends, ever.

---

## The whole install (setup surface)

This is the entire handoff. Someone inheriting it does these steps once:

1. **Publish the Site** (private). It's a Zo Site — Bun + Hono + React, already scaffolded. `publish_site` with `public=false` gives it a persistent URL.
2. **Add three secrets** in [Settings → Advanced](/?t=settings&s=advanced):
   - `OPP_API_TOKEN` — a random string. The agents use it to write to the Site's API. Generate any long random value.
   - `ZO_API_KEY` — a Zo access token (Settings → Advanced → Access Tokens), so the Site can call `/zo/ask` if you want in-dashboard drafting.
   - (optional) nothing else. Web research, Gmail, Calendar, Telegram are already native.
3. **Answer the first-run interview.** On first load the dashboard has empty Criteria, which triggers the intake in `INTAKE.md`. Your answers become the files in `brain/`. This is the only personal content in the system.
4. **Create two automations:**
   - Finder — weekly (see `SPEC.md §Scheduling` for the rrule).
   - Checker — daily.
5. **Add one or two text-command rules** so you can text `draft: [opportunity]` and `pass: [opportunity]` (`SPEC.md §Triggers`).

That's it. Publish, three secrets, interview, two automations, two rules.

---

## What's in this folder

- `README.md` — you're reading it. Overview + install.
- `SPEC.md` — the full system design, Zo-native. Records, agents, triggers, the five hunters, the shot tier, dedup, the Checker state machine, the Drafter contract, invariants, build order.
- `INTAKE.md` — the first-run interview. The questions the system asks on setup, organized so the answers become the `brain/` files it reads on every run. This is the depersonalization layer: ship it blank, interview the new user, it's theirs.
- `brain/` — seed structure for the files the agents read. Populated by the intake. Ships as templates, not filled in.

---

## Packaging to sell

This isn't just giveable, it's sellable, and the same mechanic does both work. Every piece of personal content is isolated to `brain/` and the Criteria record. The system ships blank, and the first-run interview (`INTAKE.md`) builds each buyer their own version. A buyer gets an empty machine, answers the interview, and it's theirs. Nothing of the seller's leaks.

**What the buyer gets:** the system (dashboard + three agents + the store) and the interview that arms it.
**What the buyer brings:** their own proof bank, network, and offers. That's correct — you sell the machine, not your relationships. Cleaner product story anyway.

**What selling adds on top of giving away** (bake in now, don't retrofit):

- **A five-step install that survives a stranger.** The checklist above is the product's onboarding. It has to be genuinely five steps, tested from a clean account. A paying customer won't forgive what a friend would.
- **A zero-leak audit.** No API keys, no Gmail/Calendar connection, no proof points, no network file shipped anywhere. Hard requirement for a sold product, not a nice-to-have. Already true by design; verify it before every release.
- **A licensing + "what you get" boundary** stated up front, so the buyer knows the line between the system (theirs to run) and their own inputs (theirs to supply).
- **A video walkthrough as part of the product.** The seller records a walk-through of the install and the first-run interview. For an ADHD-friendly, non-technical buyer that video is often what closes the sale and prevents refunds, more than any doc. The interview *is* the first ten minutes a buyer experiences, so it has to feel like a smart intake, not a form.

**Product framing (working):** this slots next to "Hire Your First AI Employee" as a productized offer. Candidate names floated: **Hire Your First AI Employee**, **Money Research**, or similar. Not yet in the skills repo. Intended path: pull it off the Notion Vault, package it under one of those names, sell it with the video walk.

---

## The three non-negotiables

1. **Never auto-submits.** Finder finds, Checker verifies, Drafter drafts. A human sends.
2. **One store, one service layer.** No agent touches the database directly. Every write goes through the service for validation, ownership, dedup, and audit.
3. **Live evidence for every find and every check.** No stale memory. If a door can't be verified this run, it says so instead of pretending.
