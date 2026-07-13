#!/bin/bash
# Aura AI Subtask Generator - Scheduled Agent Wrapper
# This script is called by the Zo scheduled agent to generate subtasks

cd /home/workspace/Skills/aura-subtask-generator/scripts
bun run generate-subtasks.ts
