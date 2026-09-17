import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";
import {
  checkerUpdateHealth,
  drafterSaveDraft,
  finderUpsert,
  getDraft,
  getState,
  recordRun,
  saveCriteria,
  userSetStatus,
  userSetStatusByTitle,
  type FinderInput,
} from "./backend-lib/store";
import type { Status } from "./src/lib/opp-types";

// AI agents: read README.md for navigation and contribution guidance.
type Mode = "development" | "production";
const app = new Hono();

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

// ---------------------------------------------------------------------------
// API routes.
//
// Two classes of writer, one service layer (backend-lib/store.ts):
//   - Agents (Finder / Checker / Drafter / text commands) call the bearer-
//     protected routes below using the OPP_API_TOKEN secret.
//   - The owner's dashboard calls the unauthenticated /api/status + /api/criteria
//     routes. Those are safe because the published site is private (owner-only),
//     so only the signed-in owner can reach them.
// No writer touches the DB directly. All writes go through the store.
// ---------------------------------------------------------------------------

function tokenOk(c: any): boolean {
  const secret = process.env.OPP_API_TOKEN;
  if (!secret || secret === "none") return false;
  const auth = c.req.header("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7) === secret;
}

const requireToken = async (c: any, next: any) => {
  if (!tokenOk(c)) return c.json({ error: "Unauthorized" }, 401);
  return next();
};

// --- read path (open; the site itself is private) ---
app.get("/api/state", (c) => c.json(getState()));
app.get("/api/opportunities/:id/draft", (c) => {
  const d = getDraft(c.req.param("id"));
  return d ? c.json(d) : c.json({ error: "no draft" }, 404);
});

// --- agent write path (bearer OPP_API_TOKEN) ---
app.post("/api/opportunities", requireToken, async (c) => {
  const body = (await c.req.json()) as FinderInput;
  if (!body?.opportunity || !body?.opportunityType) {
    return c.json({ error: "opportunity and opportunityType required" }, 400);
  }
  const result = finderUpsert(body);
  return c.json(result, result.action === "rejected" ? 422 : 200);
});

app.post("/api/opportunities/:id/health", requireToken, async (c) => {
  const body = await c.req.json();
  const ok = checkerUpdateHealth(c.req.param("id"), {
    health: body.health,
    healthReason: body.healthReason,
    lastSeenOpen: body.lastSeenOpen,
  });
  return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});

app.post("/api/opportunities/:id/draft", requireToken, async (c) => {
  const body = await c.req.json();
  const draft = drafterSaveDraft({
    opportunityId: c.req.param("id"),
    applicationUrl: body.applicationUrl,
    body: body.body,
    score: body.score,
    scoreNotes: body.scoreNotes,
    flag: body.flag,
    passes: body.passes,
  });
  return draft ? c.json(draft) : c.json({ error: "not found" }, 404);
});

// Title-based command endpoint for text triggers (pass:/submitted:/won:).
app.post("/api/command", requireToken, async (c) => {
  const body = await c.req.json();
  const map: Record<string, Status> = {
    pass: "Passed",
    submitted: "Submitted",
    won: "Won",
    applying: "Applying",
    pitching: "Pitching",
  };
  const status = map[String(body.command || "").toLowerCase()];
  if (!status || !body.title) return c.json({ error: "command and title required" }, 400);
  const r = userSetStatusByTitle(body.title, status);
  if (r.ok) return c.json({ ok: true, matched: r.matched, status });
  if (r.multiple) return c.json({ error: "multiple matches" }, 409);
  return c.json({ error: "not found" }, 404);
});

// Runs (Finder/Checker report their run summary here).
app.post("/api/runs", requireToken, async (c) => {
  const body = await c.req.json();
  return c.json(recordRun(body));
});

// --- owner dashboard write path (private-site gated, no token) ---
app.post("/api/status", async (c) => {
  const body = await c.req.json();
  const ok = userSetStatus(body.id, body.status);
  return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});

app.post("/api/criteria", async (c) => {
  const body = await c.req.json();
  return c.json(saveCriteria({ ...body, seeded: true }));
});

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

/**
 * Determine port based on mode. In production, use the published_port if available.
 * In development, always use the local_port.
 * Ports are managed by the system and injected via the PORT environment variable.
 */
const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

/**
 * Configure routing for production builds.
 *
 * - Streams prebuilt assets from `dist`.
 * - Static files from `public/` are copied to `dist/` by Vite and served at root paths.
 * - Falls back to `index.html` for any other GET so the SPA router can resolve the request.
 */
function configureProduction(app: Hono) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();

    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();

    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) {
        return new Response(file);
      }
    }

    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
}

/**
 * Configure routing for development builds.
 *
 * - Boots Vite in middleware mode for transforms.
 * - Static files from `public/` are served at root paths (matching Vite convention).
 * - Mirrors production routing semantics so SPA routes behave consistently.
 */
async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, {
          headers: { "Cache-Control": "no-store, must-revalidate" },
        });
      }

      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, {
            headers: { "Cache-Control": "no-store, must-revalidate" },
          });
        }
      }

      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }

      if (result) {
        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate",
          },
        });
      }

      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, {
        headers: { "Cache-Control": "no-store, must-revalidate" },
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}
