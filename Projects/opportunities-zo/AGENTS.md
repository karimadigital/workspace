# AGENTS.md — Opportunities (Zo Site)

Orientation for anyone (human or agent) working on this project. Read `SPEC.md` for the full design, `README.md` for the product/sell framing, `INTAKE.md` for the first-run interview.

## What this is

A standalone, sellable Zo Site that finds paid opportunities where Karima's buyers gather, verifies them, and drafts applications. Three agents (Finder, Checker, Drafter), one SQLite store, one dashboard. Nothing personal is hard-coded; personal content lives only in `brain/` + the Criteria row, so it ships blank.

## Live state (as built 2026-08-06)

- **Published (private):** https://opportunities-zo-karimadigital.zo.computer (owner-only). Karima views the board there.
- **Prod service:** `svc_eGmGbTQltb0`, local_port **55707**. Agents write over `http://localhost:55707` (the public https URL 302s to login, so agents MUST use localhost).
- **Auth:** bearer `OPP_API_TOKEN`. Set on the prod service env AND stored in `agents/.opp-token` (gitignored) which the agents read. Same value both sides.
- **Automations:** Finder (weekly Mon 7am), Checker (daily 8am), Opportunity Nudge (Wed+Fri 8:30am). All Sonnet.
- **Rules:** `draft: X` fires the Drafter; `pass:/submitted:/won: X` set status via `/api/command`.
- **Data:** `data/opportunities.db` (bun:sqlite, gitignored). Two sample rows seeded; replace when the Finder runs for real.
- **Not yet done:** the first-run interview (brain/ files still templates). The Finder runs best-effort on seeded criteria defaults until then.

## Architecture (where things live)

- `backend-lib/store.ts` — THE service layer. Every mutation. Ownership (finderUpsert / checkerUpdateHealth / drafterSaveDraft / userSetStatus), dedup (canonical key + URL canonicalization), audit table. No route or agent touches the DB directly.
- `server.ts` — Hono routes. Bearer-protected agent write path (`/api/opportunities`, `/api/opportunities/:id/health`, `/api/opportunities/:id/draft`, `/api/command`, `/api/runs`); owner path (`/api/status`, `/api/criteria`) protected by the private-site gate; open reads (`/api/state`).
- `src/pages/opportunities.tsx` — the dashboard (views, cards, shot bridge display, status control). `src/lib/opp-types.ts` — shared types.
- `agents/*.md` — the Finder/Checker/Drafter playbooks the automations follow. `agents/config.json` — apiBase + token location.

## Rules of the road

- Never add a write path that bypasses `backend-lib/store.ts`.
- Never let Finder/Checker write Status; never let anything auto-submit.
- Agents write via `localhost:55707`, never the public URL.
- Keep personal content in `brain/` only, so the handoff stays clean.
- After code changes to the site, the dev server (port 51662) hot-reloads; the published prod service needs `update_user_service` (or republish) to pick them up.
