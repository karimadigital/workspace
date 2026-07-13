---
name: apify
description: Run Apify actors, fetch dataset items, and turn scraped Instagram, Threads, and competitor social data into consultant-style content and trend analysis.
compatibility: Created for Zo Computer
metadata:
  author: karimadigital.zo.computer
---

# Apify

Use this skill when you want Zo to run Apify Actors, pull data from datasets, and analyze scraped Instagram, Threads, or competitor social data.

## Setup

1. Create an Apify API token in Apify Console.
2. Save it in [Settings > Advanced](/?t=settings&s=advanced) as `APIFY_API_TOKEN`.
3. If you have a favorite social scraping Actor, keep its Actor ID handy. You can pass it directly on the command line.

## What this skill does

- Check that your Apify token works
- Run any Apify Actor synchronously or asynchronously
- Fetch dataset items from a dataset or a run
- Support Instagram and Threads analysis workflows for your own account and competitors
- Help Zo turn raw scraped posts into a consultant-style report on:
  - content pillars
  - hooks and formats
  - posting cadence
  - engagement patterns
  - trend themes
  - positioning opportunities

## Script

Use `Skills/apify/scripts/apify.ts`.

### Examples

```bash
bun Skills/apify/scripts/apify.ts whoami
bun Skills/apify/scripts/apify.ts run-sync "username~actor-name" '{"search":"instagram","limit":10}'
bun Skills/apify/scripts/apify.ts run "username~actor-name" '{"search":"threads"}'
bun Skills/apify/scripts/apify.ts dataset-items "dataset-id" --limit 20
bun Skills/apify/scripts/apify.ts run-result "run-id"
```

## Instagram + Threads workflow

1. Run an Instagram or Threads-focused Actor for your profile and each competitor.
2. Pull the resulting dataset items.
3. Ask Zo to compare:
   - repeating themes
   - post types that show up most
   - engagement signals
   - frequency and consistency
   - audience positioning gaps
   - trend opportunities to test next

If you want Zo to act as the consultant, give it the raw dataset items and ask for a short strategic readout.
