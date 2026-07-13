#!/usr/bin/env bun
import { readFile } from "node:fs/promises";

const API_BASE = "https://api.apify.com/v2";
const token = process.env.APIFY_API_TOKEN;

function usage(): never {
  console.log(`Usage:
  apify.ts whoami
  apify.ts run-sync <actorId> [jsonInput|@file.json]
  apify.ts run <actorId> [jsonInput|@file.json]
  apify.ts run-result <runId>
  apify.ts dataset-items <datasetId> [--limit N] [--offset N]

Environment:
  APIFY_API_TOKEN required
`);
  process.exit(1);
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

async function readJsonArg(arg?: string): Promise<any> {
  if (!arg) return {};
  if (arg.startsWith("@")) {
    return JSON.parse(await readFile(arg.slice(1), "utf8"));
  }
  return JSON.parse(arg);
}

async function api(path: string, init: RequestInit = {}) {
  if (!token) die("APIFY_API_TOKEN is missing. Add it in Settings > Advanced.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep text
  }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    die(`Apify request failed (${res.status} ${res.statusText}):\n${detail}`);
  }
  return data;
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) usage();

  switch (cmd) {
    case "whoami": {
      const me = await api("/users/me");
      printJson(me);
      return;
    }

    case "run-sync": {
      const [actorId, inputArg] = rest;
      if (!actorId) usage();
      const input = await readJsonArg(inputArg);
      const result = await api(`/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      printJson(result);
      return;
    }

    case "run": {
      const [actorId, inputArg] = rest;
      if (!actorId) usage();
      const input = await readJsonArg(inputArg);
      const result = await api(`/acts/${encodeURIComponent(actorId)}/runs`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      printJson(result);
      return;
    }

    case "run-result": {
      const [runId] = rest;
      if (!runId) usage();
      const result = await api(`/actor-runs/${encodeURIComponent(runId)}`);
      printJson(result);
      return;
    }

    case "dataset-items": {
      const [datasetId, ...flags] = rest;
      if (!datasetId) usage();
      let limit = 100;
      let offset = 0;
      for (let i = 0; i < flags.length; i += 2) {
        const flag = flags[i];
        const value = flags[i + 1];
        if (flag === "--limit" && value) limit = Number(value);
        if (flag === "--offset" && value) offset = Number(value);
      }
      const query = new URLSearchParams({ clean: "true", format: "json", limit: String(limit), offset: String(offset) });
      const result = await api(`/datasets/${encodeURIComponent(datasetId)}/items?${query.toString()}`);
      printJson(result);
      return;
    }

    default:
      usage();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
