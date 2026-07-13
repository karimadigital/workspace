#!/usr/bin/env bun
/**
 * Aura AI Subtask Generator
 * 
 * This script checks the Aura AI Airtable base for tasks with empty SubTasks
 * and generates detailed, actionable subtasks for each one.
 */

import Airtable from 'airtable';

// Aura AI Airtable configuration
const BASE_ID = 'app2FiltK3UIOwHQr';
const TABLE_ID = 'tblf41qVj4fod8rPQ';
const SUBTASKS_FIELD = 'SubTasks';
const NAME_FIELD = 'Name';

// Initialize Airtable with OAuth token from environment
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_OAUTH_TOKEN });
const base = airtable.base(BASE_ID);
const table = base(TABLE_ID);

interface Task {
  id: string;
  name: string;
  fields: Record<string, any>;
}

/**
 * Fetch tasks with empty SubTasks field
 */
async function getTasksWithEmptySubtasks(): Promise<Task[]> {
  const tasks: Task[] = [];
  
  // Formula to find records where SubTasks is empty
  const formula = `OR({${SUBTASKS_FIELD}} = BLANK(), {${SUBTASKS_FIELD}} = '')`;
  
  await table.select({
    filterByFormula: formula,
    fields: [NAME_FIELD, SUBTASKS_FIELD]
  }).eachPage((records, fetchNextPage) => {
    for (const record of records) {
      tasks.push({
        id: record.id,
        name: record.get(NAME_FIELD) as string || 'Untitled Task',
        fields: record.fields
      });
    }
    fetchNextPage();
  });
  
  return tasks;
}

/**
 * Generate detailed subtasks using Zo AI via the /zo/ask API
 */
async function generateSubtasks(taskName: string): Promise<string> {
  const prompt = `You are a productivity assistant helping to break down high-level tasks into detailed, actionable subtasks.

Task: "${taskName}"

Please create 3-7 specific, actionable subtasks that break down this task into clear steps. Each subtask should:
- Start with an action verb (Research, Draft, Review, Contact, etc.)
- Be specific and concrete
- Include any relevant details or considerations
- Be achievable in a single work session

Format the subtasks as a numbered list. Be thorough but concise.`;

  const response = await fetch('https://api.zo.computer/zo/ask', {
    method: 'POST',
    headers: {
      'Authorization': process.env.ZO_CLIENT_IDENTITY_TOKEN || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input: prompt })
  });

  if (!response.ok) {
    throw new Error(`Zo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.output || 'Error generating subtasks';
}

/**
 * Update a task record with generated subtasks
 */
async function updateTaskSubtasks(recordId: string, subtasks: string): Promise<void> {
  await table.update(recordId, {
    [SUBTASKS_FIELD]: subtasks
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Checking Aura AI Airtable for tasks with empty SubTasks...\n');
  
  try {
    // Get tasks with empty SubTasks
    const tasks = await getTasksWithEmptySubtasks();
    
    if (tasks.length === 0) {
      console.log('✅ No tasks with empty SubTasks found. All caught up!');
      return;
    }
    
    console.log(`📋 Found ${tasks.length} task(s) needing subtasks:\n`);
    
    // Process each task
    for (const task of tasks) {
      console.log(`📝 Processing: "${task.name}"`);
      
      try {
        // Generate subtasks
        const subtasks = await generateSubtasks(task.name);
        
        // Update the record
        await updateTaskSubtasks(task.id, subtasks);
        
        console.log(`✅ Updated with subtasks\n`);
      } catch (error) {
        console.error(`❌ Error processing "${task.name}":`, error);
      }
    }
    
    console.log('\n🎉 Done! All tasks have been updated with subtasks.');
    
  } catch (error) {
    console.error('❌ Error fetching tasks:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}
