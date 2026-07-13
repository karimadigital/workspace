# Aura AI Subtask Generator - Scheduled Agent Instructions

Copy and paste these instructions when creating your scheduled agent at [Scheduled Tasks](/?t=agents).

---

## Schedule
```
0 0 * * *
```
(Run daily at midnight EST)

## Instructions

```
Check the Aura AI Airtable base for tasks with empty SubTasks fields and generate detailed subtasks.

STEPS:

1. First, list all records from the Tasks table with empty SubTasks:
   - Use airtable_oauth-list-records
   - Base ID: app2FiltK3UIOwHQr
   - Table ID: tblf41qVj4fod8rPQ
   - filterByFormula: OR({SubTasks} = BLANK(), {SubTasks} = '')
   - maxRecords: 50 (to process in batches)

2. For each task found:
   a. Read the task name from the "Name" field
   b. Generate 3-7 detailed, actionable subtasks that break down the work
   c. Format subtasks as a numbered list with action verbs (Research, Draft, Review, Contact, etc.)

3. Update each task record:
   - Use airtable_oauth-update-record
   - Base ID: app2FiltK3UIOwHQr
   - Table ID: tblf41qVj4fod8rPQ
   - recordId: [the task's record ID]
   - Fields to update: {"SubTasks": "[generated subtasks]"}

EXAMPLE SUBTASK FORMAT:
1. Research [topic] and identify 3-5 key resources
2. Draft outline based on findings
3. Create first version of deliverable
4. Review and refine for clarity
5. Final review and mark complete

GUIDELINES FOR SUBTASK GENERATION:
- Be specific and concrete
- Include relevant details or considerations
- Make each subtask achievable in a single work session
- Tailor subtasks to the type of task (creative, administrative, technical, etc.)
- For meetings: include prep, agenda, follow-up items
- For content creation: include research, drafting, editing, publishing steps
- For outreach: include research, personalization, sending, follow-up

LOGGING:
- Report how many tasks were processed
- List the names of tasks that were updated
- Report any errors encountered
```

---

## Quick Reference

| Parameter | Value |
|-----------|-------|
| Base ID | `app2FiltK3UIOwHQr` |
| Table ID | `tblf41qVj4fod8rPQ` |
| Task Name Field | `Name` |
| SubTasks Field | `SubTasks` |
| Filter Formula | `OR({SubTasks} = BLANK(), {SubTasks} = '')` |

## Testing

To test manually before scheduling:
1. Go to [Scheduled Tasks](/?t=agents)
2. Create a one-time agent with these same instructions
3. Run it immediately to verify it works
4. Then create the recurring daily agent
