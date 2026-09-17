#!/usr/bin/env bun
// Two-way mirror between the Opportunities board and a Notion database.
//
//   bun agents/notion-sync.ts init    Create the Notion database (once)
//   bun agents/notion-sync.ts sync    One reconciliation pass
//   bun agents/notion-sync.ts watch   Loop forever (used by the service)
//
// Board is source of truth for content. Status is two-way: whichever side
// changed since the last pass wins, with Notion winning a genuine tie.
// All writes back into the board go through the HTTP API so store.ts stays
// the only thing touching the opportunities table.

import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = join(import.meta.dir, "..");
const BOARD_DB = join(PROJECT, "data", "opportunities.db");
const SYNC_DB = join(PROJECT, "data", "notion-sync.db");
const API_BASE = process.env.OPP_API_BASE || "http://localhost:55707";
const NOTION_VERSION = "2022-06-28";
const POLL_SECONDS = Number(process.env.NOTION_SYNC_INTERVAL || 60);

function notionKey(): string {
  const fromEnv = process.env.NOTION_API_KEY;
  if (fromEnv) return fromEnv.trim();
  const p = join(homedir(), ".config", "notion", "api_key");
  if (existsSync(p)) return readFileSync(p, "utf8").trim();
  throw new Error(
    "No Notion key. Set NOTION_API_KEY or write it to ~/.config/notion/api_key",
  );
}

function oppToken(): string {
  const p = join(PROJECT, "agents", ".opp-token");
  if (existsSync(p)) return readFileSync(p, "utf8").trim();
  return process.env.OPP_API_TOKEN || "";
}

async function notion(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${notionKey()}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Notion ${res.status} on ${path}: ${json.message || text}`);
  }
  return json;
}

// ---------- local sync state ----------

const sync = new Database(SYNC_DB, { create: true });
sync.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
sync.run(`CREATE TABLE IF NOT EXISTS links (
  opp_id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  last_status TEXT,
  last_draft_id TEXT,
  last_fingerprint TEXT,
  updated_at TEXT
)`);

const getMeta = (k: string): string | null =>
  (sync.query("SELECT value FROM meta WHERE key = ?").get(k) as any)?.value ?? null;
const setMeta = (k: string, v: string) =>
  sync.run("INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?", [k, v, v]);

// ---------- board reads ----------

const STATUSES = ["To review", "Applying", "Pitching", "Submitted", "Won", "Passed"];

type Opp = Record<string, any>;

function readBoard(): { opps: Opp[]; drafts: Map<string, any> } {
  const db = new Database(BOARD_DB, { readonly: true });
  const opps = db.query("SELECT * FROM opportunities").all() as Opp[];
  const drafts = new Map<string, any>();
  for (const d of db.query("SELECT * FROM drafts").all() as any[]) {
    drafts.set(d.id, d);
  }
  db.close();
  return { opps, drafts };
}

async function setBoardStatus(id: string, status: string) {
  const res = await fetch(`${API_BASE}/api/status`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${oppToken()}` },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error(`board status write failed (${res.status}) for ${id}`);
}

// ---------- property mapping ----------

const txt = (s: any) =>
  s == null || s === "" ? { rich_text: [] } : { rich_text: [{ text: { content: String(s).slice(0, 1900) } }] };
const sel = (s: any) => (s == null || s === "" ? { select: null } : { select: { name: String(s).slice(0, 90) } });
const num = (n: any) => ({ number: n == null || n === "" ? null : Number(n) });
const url = (u: any) => ({ url: u && String(u).startsWith("http") ? String(u) : null });
const date = (d: any) => {
  const s = String(d || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? { date: { start: s.slice(0, 10) } } : { date: null };
};

function propsFor(o: Opp) {
  return {
    Name: { title: [{ text: { content: String(o.opportunity || "Untitled").slice(0, 1900) } }] },
    Status: sel(o.status),
    Organizer: txt(o.organizer),
    Type: sel(o.opportunity_type),
    Score: num(o.opportunity_score),
    Pays: sel(o.pays),
    Compensation: txt(o.compensation),
    "Cost to Apply": txt(o.cost_to_apply),
    Deadline: date(o.deadline),
    "Deadline Type": sel(o.deadline_type),
    Location: txt(o.location),
    Format: sel(o.virtual_in_person),
    Health: sel(o.health),
    "Draft Score": num(o.draft_score),
    "Draft Flag": txt(o.draft_flag),
    "Application URL": url(o.application_url),
    "Opportunity URL": url(o.opportunity_url),
    "Board ID": txt(o.id),
  };
}

function fingerprint(o: Opp): string {
  const p = propsFor(o) as any;
  const { Status, ...rest } = p;
  return JSON.stringify(rest);
}

// ---------- page body ----------

function chunk(s: string, size = 1900): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.length ? out : [""];
}

function para(s: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: s } }] } };
}
function head(s: string) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: [{ text: { content: s } }] } };
}

function bodyBlocks(o: Opp, draft: any): any[] {
  const blocks: any[] = [];
  if (draft?.body) {
    blocks.push(head("Draft"));
    if (draft.score != null) {
      blocks.push(para(`Score ${draft.score}${draft.flag ? ` · ${draft.flag}` : ""}`));
    }
    for (const line of String(draft.body).split(/\n{2,}/)) {
      const t = line.trim();
      if (!t) continue;
      for (const c of chunk(t)) blocks.push(para(c));
    }
    if (draft.score_notes) {
      blocks.push(head("Score notes"));
      for (const c of chunk(String(draft.score_notes))) blocks.push(para(c));
    }
  } else {
    blocks.push(head("Draft"));
    blocks.push(para("No draft yet. Text “draft: " + String(o.opportunity).slice(0, 60) + "” to generate one."));
  }
  if (o.why_it_fits) {
    blocks.push(head("Why it fits"));
    for (const c of chunk(String(o.why_it_fits))) blocks.push(para(c));
  }
  if (o.revenue_path) {
    blocks.push(head("Revenue path"));
    for (const c of chunk(String(o.revenue_path))) blocks.push(para(c));
  }
  return blocks.slice(0, 95);
}

async function replaceBody(pageId: string, blocks: any[]) {
  const existing = await notion(`/blocks/${pageId}/children?page_size=100`);
  for (const b of existing.results || []) {
    await notion(`/blocks/${b.id}`, { method: "DELETE" });
  }
  for (let i = 0; i < blocks.length; i += 90) {
    await notion(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: blocks.slice(i, i + 90) }),
    });
  }
}

// ---------- init ----------

async function init(parentPageId?: string) {
  const existing = getMeta("database_id");
  if (existing) {
    console.log(`Database already linked: ${existing}`);
    return existing;
  }
  let parent = parentPageId || process.env.NOTION_PARENT_PAGE_ID;
  if (!parent) {
    const found = await notion("/search", {
      method: "POST",
      body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 25 }),
    });
    const first = (found.results || [])[0];
    if (!first) {
      throw new Error(
        "No page shared with the integration. In Notion open the page you want this under, click ... > Connections > add your integration, then rerun.",
      );
    }
    parent = first.id;
    const title =
      first.properties?.title?.title?.[0]?.plain_text ||
      Object.values(first.properties || {}).flatMap((p: any) => p?.title?.[0]?.plain_text || [])[0] ||
      "(untitled)";
    console.log(`Using parent page: ${title} (${parent})`);
  }

  const db = await notion("/databases", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parent },
      title: [{ text: { content: "Opportunities" } }],
      properties: {
        Name: { title: {} },
        Status: { select: { options: STATUSES.map((name) => ({ name })) } },
        Organizer: { rich_text: {} },
        Type: { select: {} },
        Score: { number: {} },
        Pays: { select: {} },
        Compensation: { rich_text: {} },
        "Cost to Apply": { rich_text: {} },
        Deadline: { date: {} },
        "Deadline Type": { select: {} },
        Location: { rich_text: {} },
        Format: { select: {} },
        Health: { select: {} },
        "Draft Score": { number: {} },
        "Draft Flag": { rich_text: {} },
        "Application URL": { url: {} },
        "Opportunity URL": { url: {} },
        "Board ID": { rich_text: {} },
      },
    }),
  });
  setMeta("database_id", db.id);
  console.log(`Created Notion database ${db.id}`);
  console.log(`URL: ${db.url}`);
  return db.id;
}

// ---------- sync ----------

function statusOf(page: any): string {
  return page.properties?.Status?.select?.name || "";
}

async function allPages(databaseId: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    out.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function runSync(verbose = true) {
  const databaseId = getMeta("database_id");
  if (!databaseId) throw new Error("Not initialised. Run: bun agents/notion-sync.ts init");

  const { opps, drafts } = readBoard();
  const pages = await allPages(databaseId);

  const byBoardId = new Map<string, any>();
  for (const p of pages) {
    const bid = p.properties?.["Board ID"]?.rich_text?.[0]?.plain_text;
    if (bid) byBoardId.set(bid, p);
  }

  let created = 0,
    toNotion = 0,
    toBoard = 0,
    bodies = 0;

  for (const o of opps) {
    const link = sync.query("SELECT * FROM links WHERE opp_id = ?").get(o.id) as any;
    let page = byBoardId.get(o.id) || (link ? pages.find((p) => p.id === link.page_id) : null);
    const draft = o.draft_id ? drafts.get(o.draft_id) : null;
    const fp = fingerprint(o);

    if (!page) {
      const createdPage = await notion("/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: propsFor(o),
          children: bodyBlocks(o, draft),
        }),
      });
      sync.run(
        "INSERT INTO links (opp_id,page_id,last_status,last_draft_id,last_fingerprint,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(opp_id) DO UPDATE SET page_id=?,last_status=?,last_draft_id=?,last_fingerprint=?,updated_at=?",
        [o.id, createdPage.id, o.status, o.draft_id || "", fp, new Date().toISOString(),
         createdPage.id, o.status, o.draft_id || "", fp, new Date().toISOString()],
      );
      created++;
      continue;
    }

    const nStatus = statusOf(page);
    const bStatus = o.status;
    const last = link?.last_status ?? bStatus;
    let settled = bStatus;

    if (nStatus && nStatus !== last && nStatus !== bStatus) {
      // Notion moved. Push it into the board.
      if (STATUSES.includes(nStatus)) {
        await setBoardStatus(o.id, nStatus);
        settled = nStatus;
        toBoard++;
      }
    } else if (bStatus !== last || (nStatus && nStatus !== bStatus)) {
      // Board moved (or Notion is stale). Push the board value up.
      await notion(`/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { Status: sel(bStatus) } }),
      });
      settled = bStatus;
      toNotion++;
    }

    if (link?.last_fingerprint !== fp) {
      const p: any = propsFor(o);
      delete p.Status;
      await notion(`/pages/${page.id}`, { method: "PATCH", body: JSON.stringify({ properties: p }) });
    }

    const draftChanged = (link?.last_draft_id || "") !== (o.draft_id || "");
    if (draftChanged || !link) {
      await replaceBody(page.id, bodyBlocks(o, draft));
      bodies++;
    }

    sync.run(
      "INSERT INTO links (opp_id,page_id,last_status,last_draft_id,last_fingerprint,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(opp_id) DO UPDATE SET page_id=?,last_status=?,last_draft_id=?,last_fingerprint=?,updated_at=?",
      [o.id, page.id, settled, o.draft_id || "", fp, new Date().toISOString(),
       page.id, settled, o.draft_id || "", fp, new Date().toISOString()],
    );
  }

  if (verbose || created || toBoard || toNotion) {
    console.log(
      `[${new Date().toISOString()}] created ${created}, board->notion ${toNotion}, notion->board ${toBoard}, bodies ${bodies}`,
    );
  }
}

// ---------- main ----------

const cmd = process.argv[2] || "sync";

if (cmd === "init") {
  await init(process.argv[3]);
  await runSync();
} else if (cmd === "sync") {
  await runSync();
} else if (cmd === "watch") {
  console.log(`notion-sync watching every ${POLL_SECONDS}s`);
  for (;;) {
    try {
      await runSync(false);
    } catch (e: any) {
      console.error(`sync error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
  }
} else {
  console.log("usage: bun agents/notion-sync.ts [init|sync|watch]");
  process.exit(1);
}
