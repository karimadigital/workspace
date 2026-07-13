---
name: crm-sync
description: Daily end-of-day CRM sync agent that checks calendar for new meetings, extracts attendees, and asks the user to confirm which contacts to add to the COD Friends Airtable. Auto-categorizes based on event context.
compatibility: Created for Zo Computer
metadata:
  author: karimadigital.zo.computer
---

# CRM Sync - Daily Calendar to Airtable

This skill runs daily at end-of-day to:
1. Check the hello@karima.digital Google Calendar for meetings from today
2. Extract all attendees (excluding Karima)
3. Send a text message asking which contacts to add to Airtable
4. Auto-categorize contacts based on event title/company
5. Add confirmed contacts to the COD Friends table in the Team Crash Out Airtable base
6. Flag LinkedIn for review (does not auto-lookup)

## Usage

The skill is triggered by a scheduled agent that runs daily at 6 PM ET.

## Configuration

- **Calendar:** hello@karima.digital
- **Airtable Base:** Team Crash Out (appfGhgV2Bx8OYZqE)
- **Airtable Table:** COD Friends (tblDnvLsmFk8Grwk8)
- **Run Time:** Daily at 6 PM ET

## Auto-Categorization Rules

| Event Title Contains | Category |
|---------------------|----------|
| "pitch", "partner", "collab", "meeting" | Partner |
| "advisor", "advice", "strategy" | General Adivsor |
| "journalist", "press", "media", "story" | Journalist |
| Default | General Adivsor |

## Exclusions

Personal events to skip (email exclusions):
- hello@karima.digital (self)
- karima@firstbatch.xyz (self)
- karima@hype.partners (self)

Personal event titles to skip:
- Mom mode, Gym, Busy, Na, Parent Coffee, Thrust <> Hype Weekly

## Process Flow

1. Fetch calendar events from today
2. Parse attendees from meetings
3. Filter out personal events and self
4. Categorize contacts
5. Send SMS confirmation with list
6. On confirmation, add to Airtable