// The single service layer. Every mutation goes through here.
// No route and no agent touches the DB directly. This module owns the schema,
// migrations, validation, field ownership, deduplication, and audit history.

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import type {
  Criteria,
  DashboardState,
  Draft,
  Health,
  Opportunity,
  OpportunityType,
  Run,
  Status,
} from "../src/lib/opp-types";

const DATA_DIR = new URL("../data", import.meta.url).pathname;
const DB_PATH = `${DATA_DIR}/opportunities.db`;

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// ---------- schema / migrations ----------

db.exec(`
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  opportunity TEXT NOT NULL,
  organizer TEXT NOT NULL DEFAULT '',
  opportunity_type TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '',
  opportunity_url TEXT NOT NULL DEFAULT '',
  application_url TEXT NOT NULL DEFAULT '',
  door_type TEXT NOT NULL DEFAULT '',
  evidence_url TEXT NOT NULL DEFAULT '',
  audience_industry TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  virtual_in_person TEXT NOT NULL DEFAULT 'Unknown',
  pays TEXT NOT NULL DEFAULT 'Unknown',
  compensation TEXT NOT NULL DEFAULT '',
  cost_to_apply TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  deadline_type TEXT NOT NULL DEFAULT 'Not announced',
  deadline_note TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  cycle_year TEXT NOT NULL DEFAULT '',
  time_to_money_days INTEGER,
  revenue_path TEXT NOT NULL DEFAULT '',
  opportunity_score REAL,
  warm_link TEXT NOT NULL DEFAULT '',
  authority_basis TEXT NOT NULL DEFAULT '',
  why_it_fits TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'To review',
  health TEXT NOT NULL DEFAULT 'Unchecked',
  health_reason TEXT NOT NULL DEFAULT '',
  draft_id TEXT,
  draft_score REAL,
  draft_flag TEXT NOT NULL DEFAULT '',
  first_seen TEXT NOT NULL,
  last_checked TEXT NOT NULL DEFAULT '',
  last_seen_open TEXT NOT NULL DEFAULT '',
  canonical_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_canonical ON opportunities(canonical_key);
CREATE INDEX IF NOT EXISTS idx_opp_appurl ON opportunities(application_url);

CREATE TABLE IF NOT EXISTS criteria (
  id TEXT PRIMARY KEY,
  seeded INTEGER NOT NULL DEFAULT 0,
  topics TEXT NOT NULL DEFAULT '',
  types_on TEXT NOT NULL DEFAULT '[]',
  shot_tier_on INTEGER NOT NULL DEFAULT 0,
  shot_size_threshold TEXT NOT NULL DEFAULT '',
  industry_seed TEXT NOT NULL DEFAULT '',
  standing_territory TEXT NOT NULL DEFAULT '',
  location_weighting TEXT NOT NULL DEFAULT '',
  pay_posture TEXT NOT NULL DEFAULT '',
  design_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  application_url TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  score REAL,
  score_notes TEXT NOT NULL DEFAULT '',
  flag TEXT NOT NULL DEFAULT '',
  passes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL DEFAULT '',
  hunters_attempted INTEGER NOT NULL DEFAULT 0,
  count_new INTEGER NOT NULL DEFAULT 0,
  count_duplicates INTEGER NOT NULL DEFAULT 0,
  count_updated INTEGER NOT NULL DEFAULT 0,
  count_rejected INTEGER NOT NULL DEFAULT 0,
  count_expired_changed INTEGER NOT NULL DEFAULT 0,
  errors TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
`);

// ---------- helpers ----------

function now(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Strip tracking params and fragments so the same door doesn't read as two URLs.
function canonUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const drop = [...u.searchParams.keys()].filter(
      (k) => k.startsWith("utm_") || ["fbclid", "gclid", "ref", "source"].includes(k),
    );
    drop.forEach((k) => u.searchParams.delete(k));
    u.hash = "";
    return `${u.origin}${u.pathname}${u.search}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function canonicalKey(organizer: string, opportunity: string, cycleYear: string): string {
  return `${norm(organizer)}::${norm(opportunity)}::${norm(cycleYear)}`;
}

function audit(actor: string, action: string, targetId = "", detail = ""): void {
  db.query(
    "INSERT INTO audit (at, actor, action, target_id, detail) VALUES (?,?,?,?,?)",
  ).run(now(), actor, action, targetId, detail);
}

// ---------- row mapping ----------

function rowToOpportunity(r: any): Opportunity {
  return {
    id: r.id,
    opportunity: r.opportunity,
    organizer: r.organizer,
    opportunityType: r.opportunity_type,
    format: r.format,
    opportunityUrl: r.opportunity_url,
    applicationUrl: r.application_url,
    doorType: r.door_type,
    evidenceUrl: r.evidence_url,
    audienceIndustry: r.audience_industry,
    location: r.location,
    virtualInPerson: r.virtual_in_person,
    pays: r.pays,
    compensation: r.compensation,
    costToApply: r.cost_to_apply,
    deadline: r.deadline,
    deadlineType: r.deadline_type,
    deadlineNote: r.deadline_note,
    eventDate: r.event_date,
    cycleYear: r.cycle_year,
    timeToMoneyDays: r.time_to_money_days,
    revenuePath: r.revenue_path,
    opportunityScore: r.opportunity_score,
    warmLink: r.warm_link,
    authorityBasis: r.authority_basis,
    whyItFits: r.why_it_fits,
    status: r.status,
    health: r.health,
    healthReason: r.health_reason,
    draftId: r.draft_id,
    draftScore: r.draft_score,
    draftFlag: r.draft_flag,
    firstSeen: r.first_seen,
    lastChecked: r.last_checked,
    lastSeenOpen: r.last_seen_open,
    canonicalKey: r.canonical_key,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Discovery fields Finder is allowed to write. Never status/health/draft.
const DISCOVERY_FIELDS: Record<string, string> = {
  opportunity: "opportunity",
  organizer: "organizer",
  opportunityType: "opportunity_type",
  format: "format",
  opportunityUrl: "opportunity_url",
  applicationUrl: "application_url",
  doorType: "door_type",
  evidenceUrl: "evidence_url",
  audienceIndustry: "audience_industry",
  location: "location",
  virtualInPerson: "virtual_in_person",
  pays: "pays",
  compensation: "compensation",
  costToApply: "cost_to_apply",
  deadline: "deadline",
  deadlineType: "deadline_type",
  deadlineNote: "deadline_note",
  eventDate: "event_date",
  cycleYear: "cycle_year",
  timeToMoneyDays: "time_to_money_days",
  revenuePath: "revenue_path",
  opportunityScore: "opportunity_score",
  warmLink: "warm_link",
  authorityBasis: "authority_basis",
  whyItFits: "why_it_fits",
};

export type FinderInput = Partial<Opportunity> & {
  opportunity: string;
  opportunityType: OpportunityType;
};

export interface FinderResult {
  action: "inserted" | "updated" | "rejected";
  id?: string;
  reason?: string;
}

// ---------- Finder: discover / upsert (never status, health, draft) ----------

export function finderUpsert(input: FinderInput): FinderResult {
  const organizer = input.organizer ?? "";
  const cycleYear = input.cycleYear ?? String(new Date().getFullYear());
  const isShot = input.opportunityType === "Shot (warm-adjacent)";

  // Shot gate: must carry a bridge and an authority basis.
  if (isShot && (!input.warmLink?.trim() || !input.authorityBasis?.trim())) {
    audit("finder", "reject-shot-missing-gate", "", input.opportunity);
    return { action: "rejected", reason: "Shot requires warmLink + authorityBasis" };
  }

  const key = canonicalKey(organizer, input.opportunity, cycleYear);
  const appUrl = canonUrl(input.applicationUrl ?? "");
  const oppUrl = canonUrl(input.opportunityUrl ?? "");

  // Dedup match order: canonical app url -> canonical opp url -> organizer+opp+year.
  let existing: any = null;
  if (appUrl) {
    existing = db
      .query("SELECT * FROM opportunities WHERE application_url != '' AND lower(application_url) = ?")
      .get(appUrl);
  }
  if (!existing && oppUrl) {
    existing = db
      .query("SELECT * FROM opportunities WHERE opportunity_url != '' AND lower(opportunity_url) = ?")
      .get(oppUrl);
  }
  if (!existing) {
    existing = db.query("SELECT * FROM opportunities WHERE canonical_key = ?").get(key);
  }

  const ts = now();

  if (existing) {
    // Update SAFE discovery fields only. Never status/health/draft.
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [field, col] of Object.entries(DISCOVERY_FIELDS)) {
      const v = (input as any)[field];
      if (v !== undefined && v !== null && v !== "") {
        sets.push(`${col} = ?`);
        vals.push(v);
      }
    }
    if (sets.length === 0) return { action: "updated", id: existing.id };
    sets.push("canonical_key = ?");
    vals.push(key);
    sets.push("updated_at = ?");
    vals.push(ts);
    vals.push(existing.id);
    db.query(`UPDATE opportunities SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    audit("finder", "update-discovery", existing.id, input.opportunity);
    return { action: "updated", id: existing.id };
  }

  const id = uid("opp");
  db.query(
    `INSERT INTO opportunities (
      id, opportunity, organizer, opportunity_type, format, opportunity_url, application_url,
      door_type, evidence_url, audience_industry, location, virtual_in_person, pays, compensation,
      cost_to_apply, deadline, deadline_type, deadline_note, event_date, cycle_year,
      time_to_money_days, revenue_path, opportunity_score, warm_link, authority_basis, why_it_fits,
      status, health, health_reason, draft_id, draft_score, draft_flag,
      first_seen, last_checked, last_seen_open, canonical_key, created_at, updated_at
    ) VALUES (
      ?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?, 'To review','Unchecked','', NULL, NULL,'', ?,'','', ?,?,?
    )`,
  ).run(
    id,
    input.opportunity,
    organizer,
    input.opportunityType,
    input.format ?? "",
    input.opportunityUrl ?? "",
    input.applicationUrl ?? "",
    input.doorType ?? "",
    input.evidenceUrl ?? "",
    input.audienceIndustry ?? "",
    input.location ?? "",
    input.virtualInPerson ?? "Unknown",
    input.pays ?? "Unknown",
    input.compensation ?? "",
    input.costToApply ?? "",
    input.deadline ?? "",
    input.deadlineType ?? "Not announced",
    input.deadlineNote ?? "",
    input.eventDate ?? "",
    cycleYear,
    input.timeToMoneyDays ?? null,
    input.revenuePath ?? "",
    input.opportunityScore ?? null,
    input.warmLink ?? "",
    input.authorityBasis ?? "",
    input.whyItFits ?? "",
    ts, // first_seen
    key,
    ts, // created_at
    ts, // updated_at
  );
  audit("finder", "insert", id, input.opportunity);
  return { action: "inserted", id };
}

// ---------- Checker: health only ----------

export function checkerUpdateHealth(
  id: string,
  patch: { health: Health; healthReason?: string; lastSeenOpen?: string },
): boolean {
  const row = db.query("SELECT id FROM opportunities WHERE id = ?").get(id);
  if (!row) return false;
  const ts = now();
  db.query(
    `UPDATE opportunities SET health = ?, health_reason = ?, last_checked = ?, last_seen_open = ?, updated_at = ? WHERE id = ?`,
  ).run(
    patch.health,
    patch.healthReason ?? "",
    ts,
    patch.lastSeenOpen ?? (patch.health === "Verified" ? ts : ""),
    ts,
    id,
  );
  audit("checker", "health", id, `${patch.health}: ${patch.healthReason ?? ""}`);
  return true;
}

// ---------- Drafter: drafts only ----------

export function drafterSaveDraft(input: {
  opportunityId: string;
  applicationUrl?: string;
  body: string;
  score?: number | null;
  scoreNotes?: string;
  flag?: string;
  passes?: number;
}): Draft | null {
  const opp = db.query("SELECT id FROM opportunities WHERE id = ?").get(input.opportunityId);
  if (!opp) return null;
  const id = uid("draft");
  const ts = now();
  db.query(
    `INSERT INTO drafts (id, opportunity_id, application_url, body, score, score_notes, flag, passes, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.opportunityId,
    input.applicationUrl ?? "",
    input.body,
    input.score ?? null,
    input.scoreNotes ?? "",
    input.flag ?? "",
    input.passes ?? 0,
    ts,
  );
  // Link the draft onto the opportunity (draft metadata is Drafter-owned).
  db.query(
    "UPDATE opportunities SET draft_id = ?, draft_score = ?, draft_flag = ?, updated_at = ? WHERE id = ?",
  ).run(id, input.score ?? null, input.flag ?? "", ts, input.opportunityId);
  audit("drafter", "save-draft", input.opportunityId, input.flag ?? `score ${input.score}`);
  return {
    id,
    opportunityId: input.opportunityId,
    applicationUrl: input.applicationUrl ?? "",
    body: input.body,
    score: input.score ?? null,
    scoreNotes: input.scoreNotes ?? "",
    flag: input.flag ?? "",
    passes: input.passes ?? 0,
    createdAt: ts,
  };
}

export function getDraft(opportunityId: string): Draft | null {
  const r: any = db
    .query("SELECT * FROM drafts WHERE opportunity_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(opportunityId);
  if (!r) return null;
  return {
    id: r.id,
    opportunityId: r.opportunity_id,
    applicationUrl: r.application_url,
    body: r.body,
    score: r.score,
    scoreNotes: r.score_notes,
    flag: r.flag,
    passes: r.passes,
    createdAt: r.created_at,
  };
}

// ---------- User: status only (the only actor allowed to set it) ----------

export function userSetStatus(id: string, status: Status): boolean {
  const row = db.query("SELECT id FROM opportunities WHERE id = ?").get(id);
  if (!row) return false;
  db.query("UPDATE opportunities SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  audit("user", "set-status", id, status);
  return true;
}

// Resolve a status change by opportunity title (for text commands like "pass: X").
export function userSetStatusByTitle(title: string, status: Status): { ok: boolean; matched?: string; multiple?: boolean } {
  const rows = db
    .query("SELECT id, opportunity FROM opportunities WHERE lower(opportunity) LIKE ?")
    .all(`%${title.toLowerCase().trim()}%`) as any[];
  if (rows.length === 0) return { ok: false };
  if (rows.length > 1) return { ok: false, multiple: true };
  userSetStatus(rows[0].id, status);
  return { ok: true, matched: rows[0].opportunity };
}

// ---------- Runs ----------

export function recordRun(run: Omit<Run, "id">): Run {
  const id = uid("run");
  db.query(
    `INSERT INTO runs (id, run_type, started_at, finished_at, hunters_attempted, count_new, count_duplicates, count_updated, count_rejected, count_expired_changed, errors, outcome, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    run.runType,
    run.startedAt,
    run.finishedAt,
    JSON.stringify(Array.isArray(run.huntersAttempted) ? run.huntersAttempted : []),
    run.countNew,
    run.countDuplicates,
    run.countUpdated,
    run.countRejected,
    run.countExpiredChanged,
    run.errors,
    run.outcome,
    run.notes,
  );
  audit(run.runType.toLowerCase(), "run", id, run.outcome);
  return { id, ...run };
}

// ---------- Criteria ----------

function rowToCriteria(r: any): Criteria {
  return {
    id: r.id,
    seeded: !!r.seeded,
    topics: r.topics,
    typesOn: JSON.parse(r.types_on || "[]"),
    shotTierOn: !!r.shot_tier_on,
    shotSizeThreshold: r.shot_size_threshold,
    industrySeed: r.industry_seed,
    standingTerritory: r.standing_territory,
    locationWeighting: r.location_weighting,
    payPosture: r.pay_posture,
    designNote: r.design_note,
    updatedAt: r.updated_at,
  };
}

export function getCriteria(): Criteria | null {
  const r: any = db.query("SELECT * FROM criteria LIMIT 1").get();
  return r ? rowToCriteria(r) : null;
}

export function saveCriteria(input: Partial<Criteria>): Criteria {
  const existing = getCriteria();
  const ts = now();
  if (existing) {
    db.query(
      `UPDATE criteria SET seeded=?, topics=?, types_on=?, shot_tier_on=?, shot_size_threshold=?,
       industry_seed=?, standing_territory=?, location_weighting=?, pay_posture=?, design_note=?, updated_at=? WHERE id=?`,
    ).run(
      input.seeded ?? existing.seeded ? 1 : 0,
      input.topics ?? existing.topics,
      JSON.stringify(input.typesOn ?? existing.typesOn),
      (input.shotTierOn ?? existing.shotTierOn) ? 1 : 0,
      input.shotSizeThreshold ?? existing.shotSizeThreshold,
      input.industrySeed ?? existing.industrySeed,
      input.standingTerritory ?? existing.standingTerritory,
      input.locationWeighting ?? existing.locationWeighting,
      input.payPosture ?? existing.payPosture,
      input.designNote ?? existing.designNote,
      ts,
      existing.id,
    );
    audit("user", "update-criteria", existing.id);
    return getCriteria()!;
  }
  const id = uid("crit");
  db.query(
    `INSERT INTO criteria (id, seeded, topics, types_on, shot_tier_on, shot_size_threshold, industry_seed, standing_territory, location_weighting, pay_posture, design_note, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    input.seeded ? 1 : 0,
    input.topics ?? "",
    JSON.stringify(input.typesOn ?? []),
    input.shotTierOn ? 1 : 0,
    input.shotSizeThreshold ?? "",
    input.industrySeed ?? "",
    input.standingTerritory ?? "",
    input.locationWeighting ?? "",
    input.payPosture ?? "",
    input.designNote ?? "",
    ts,
  );
  audit("user", "create-criteria", id);
  return getCriteria()!;
}

// ---------- Read path ----------

export function getState(): DashboardState {
  const opportunities = (db.query("SELECT * FROM opportunities ORDER BY created_at DESC").all() as any[]).map(
    rowToOpportunity,
  );
  const runs = (db.query("SELECT * FROM runs ORDER BY started_at DESC LIMIT 30").all() as any[]).map((r) => ({
    id: r.id,
    runType: r.run_type,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    huntersAttempted: (() => { try { return JSON.parse(r.hunters_attempted || "[]"); } catch { return r.hunters_attempted ? [r.hunters_attempted] : []; } })(),
    countNew: r.count_new,
    countDuplicates: r.count_duplicates,
    countUpdated: r.count_updated,
    countRejected: r.count_rejected,
    countExpiredChanged: r.count_expired_changed,
    errors: r.errors,
    outcome: r.outcome,
    notes: r.notes,
  })) as Run[];
  const criteria = getCriteria();
  return {
    opportunities,
    criteria,
    runs,
    needsInterview: !criteria || !criteria.seeded,
    generatedAt: now(),
  };
}

export function getOpportunity(id: string): Opportunity | null {
  const r: any = db.query("SELECT * FROM opportunities WHERE id = ?").get(id);
  return r ? rowToOpportunity(r) : null;
}

export { db };
