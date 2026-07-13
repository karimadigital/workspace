---
name: aura-subtask-generator
description: Automatically generates detailed subtasks for Aura AI Airtable tasks that have empty SubTasks fields. Runs daily to break down high-level tasks into actionable steps.
compatibility: Created for Zo Computer
metadata:
  author: karimadigital.zo.computer
  created: "2026-02-09"
---

# Aura Subtask Generator

This skill automatically checks the Aura AI Airtable base for tasks with empty SubTasks fields and generates detailed, actionable subtasks using AI.

## Configuration

- **Base ID**: `app2FiltK3UIOwHQr` (Aura AI)
- **Table ID**: `tblf41qVj4fod8rPQ` (Tasks)
- **SubTasks Field**: `SubTasks` (multiline text)
- **Task Name Field**: `Name`

## Setting Up the Scheduled Task

To run this automatically every night at midnight EST:

1. Go to [Scheduled Tasks](/?t=agents)
2. Click "Create New Agent"
3. Set the schedule to: `0 0 * * *` (midnight daily)
4. Use this exact instruction:

```
Check the Aura AI Airtable base for any tasks in the main Tasks table that have an empty "SubTasks" field.

For each empty task:
1. Read the task name (Name field)
2. Generate detailed, actionable subtasks that break down the work into 3-7 clear steps
3. Use airtable_oauth-update-record to fill in the "SubTasks" field with these subtasks

Base ID: app2FiltK3UIOwHQr
Table ID: tblf41qVj4fod8rPQ
Field to update: SubTasks

To find empty tasks, use airtable_oauth-list-records with filterByFormula: OR({SubTasks} = BLANK(), {SubTasks} = '')
```

5. Save the agent

## Manual Run

To run the subtask generator manually:

```bash
cd /home/workspace/Skills/aura-subtask-generator/scripts
bun run generate-subtasks.ts
```

## How It Works

1. Queries the Tasks table using Airtable OAuth
2. Filters for records where SubTasks is blank or empty
3. For each task, generates contextual subtasks based on the task name
4. Updates each record with the generated subtask list

## Requirements

- Airtable OAuth connection (already configured)
- `AIRTABLE_OAUTH_TOKEN` environment variable
- `ZO_CLIENT_IDENTITY_TOKEN` environment variable (for AI subtask generation)
