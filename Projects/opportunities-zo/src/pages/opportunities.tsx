import { useEffect, useMemo, useState } from "react";
import type { DashboardState, Health, Opportunity, Status } from "@/lib/opp-types";
import { STATUS_VALUES } from "@/lib/opp-types";

const VIEWS = [
  "Inbox",
  "Apply next",
  "Shots",
  "Submitted",
  "Won",
  "Needs attention",
  "Archive",
] as const;
type View = (typeof VIEWS)[number];

const HEALTH_TONE: Record<Health, string> = {
  Verified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "Expiring soon": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Changed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Unclear: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  Expired: "bg-muted text-muted-foreground",
  "Link dead": "bg-muted text-muted-foreground",
  Unchecked: "bg-muted text-muted-foreground",
};

const NEEDS_ATTENTION: Health[] = ["Changed", "Unclear", "Expiring soon"];
const ARCHIVE_HEALTH: Health[] = ["Expired", "Link dead"];

function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00").getTime() - Date.now();
  return Math.round(d / 86400000);
}

function filterView(opps: Opportunity[], view: View): Opportunity[] {
  switch (view) {
    case "Inbox":
      return opps.filter((o) => o.status === "To review" && !ARCHIVE_HEALTH.includes(o.health));
    case "Apply next":
      return opps
        .filter((o) => ["Pitching", "Applying"].includes(o.status))
        .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0));
    case "Shots":
      return opps.filter((o) => o.opportunityType === "Shot (warm-adjacent)" && o.status !== "Passed");
    case "Submitted":
      return opps.filter((o) => o.status === "Submitted");
    case "Won":
      return opps.filter((o) => o.status === "Won");
    case "Needs attention":
      return opps.filter(
        (o) => NEEDS_ATTENTION.includes(o.health) || (o.draftFlag && o.draftFlag.length > 0),
      );
    case "Archive":
      return opps.filter((o) => o.status === "Passed" || ARCHIVE_HEALTH.includes(o.health));
  }
}

async function setStatus(id: string, status: Status) {
  await fetch("/api/status", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ id, status }),
  });
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone ?? "bg-muted text-muted-foreground"}`}
    >
      {children}
    </span>
  );
}

function OppCard({ o, onChange }: { o: Opportunity; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const isShot = o.opportunityType === "Shot (warm-adjacent)";
  const dd = daysUntil(o.deadline);

  async function change(next: Status) {
    setBusy(true);
    await setStatus(o.id, next);
    setBusy(false);
    onChange();
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={HEALTH_TONE[o.health]}>{o.health}</Pill>
        <Pill>{o.opportunityType}</Pill>
        {o.pays !== "Unknown" && <Pill>{o.pays}</Pill>}
        {o.opportunityScore != null && (
          <Pill tone="bg-primary/10 text-primary">score {Math.round(o.opportunityScore)}</Pill>
        )}
        {o.draftScore != null && <Pill tone="bg-violet-500/15 text-violet-700 dark:text-violet-400">draft {Math.round(o.draftScore)}</Pill>}
        {o.draftFlag && <Pill tone="bg-amber-500/20 text-amber-800 dark:text-amber-300">{o.draftFlag}</Pill>}
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug">{o.opportunity}</h3>
      <p className="text-sm text-muted-foreground">
        {o.organizer}
        {o.location ? ` · ${o.location}` : ""}
        {o.format ? ` · ${o.format}` : ""}
      </p>

      {o.whyItFits && <p className="mt-2 text-sm">{o.whyItFits}</p>}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {o.deadline && (
          <span>
            Deadline {o.deadline}
            {dd != null ? ` (${dd}d)` : ""}
          </span>
        )}
        {o.deadlineType === "Rolling" && <span>Rolling</span>}
        {o.timeToMoneyDays != null && <span>~{o.timeToMoneyDays}d to money</span>}
        {o.revenuePath && <span>→ {o.revenuePath}</span>}
      </div>

      {isShot && (
        <div className="mt-3 rounded-lg border border-dashed p-2 text-xs">
          <p>
            <span className="font-semibold">Bridge:</span> {o.warmLink || "—"}
          </p>
          <p>
            <span className="font-semibold">Authority:</span> {o.authorityBasis || "—"}
          </p>
        </div>
      )}

      {o.healthReason && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Health:</span> {o.healthReason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {o.evidenceUrl && (
          <a
            href={o.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            Evidence
          </a>
        )}
        {(o.applicationUrl || o.opportunityUrl) && (
          <a
            href={o.applicationUrl || o.opportunityUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {isShot ? "Target page" : "Apply"}
          </a>
        )}
        <div className="ml-auto flex items-center gap-1">
          <select
            disabled={busy}
            value={o.status}
            onChange={(e) => change(e.target.value as Status)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function InterviewBanner() {
  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-semibold">First-run setup isn't complete.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The system is running but hasn't been armed yet. Answer the intake (see INTAKE.md) so the
        Finder has your proof bank, offers, network, and voice. Until then it can search, but drafts
        and shots won't have what they need to land.
      </p>
    </div>
  );
}

export default function OpportunitiesPage() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [view, setView] = useState<View>("Inbox");
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await fetch("/api/state", { headers: { accept: "application/json" } });
    setState(await r.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  const opps = state?.opportunities ?? [];
  const shown = useMemo(() => filterView(opps, view), [opps, view]);
  const counts = useMemo(() => {
    const m = {} as Record<View, number>;
    for (const v of VIEWS) m[v] = filterView(opps, v).length;
    return m;
  }, [opps]);

  const lastRun = state?.runs?.[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Paid work where your buyers gather. Verified, ranked by money speed. You approve every move.
        </p>
        {lastRun && (
          <p className="mt-1 text-xs text-muted-foreground">
            Last {lastRun.runType} run: {lastRun.outcome} · {lastRun.countNew} new ·{" "}
            {lastRun.countUpdated} updated · {lastRun.countRejected} rejected
          </p>
        )}
      </header>

      {state?.needsInterview && <InterviewBanner />}

      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
              view === v
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {v}
            <span className="ml-1.5 opacity-70">{counts[v] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing in {view} yet.
          {view === "Inbox" && " The Finder adds new opportunities here on its weekly run."}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => (
            <OppCard key={o.id} o={o} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}
