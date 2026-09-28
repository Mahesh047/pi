---
name: "delegate-with-subagent"
description: "Use the subagent tool to delegate research or editing tasks to an isolated subprocess, keeping the main context window lean."
version: 2
created: "2026-06-10"
updated: "2026-06-10"
---
## When to Use
Use when a task requires reading many files or making edits that would fill the main context window. Delegate recon, file analysis, or focused edits to a subagent and receive only a structured summary back.

## Procedure
1. Identify whether the task is recon (scout/researcher) or editing (editor).
2. Use the subagent tool: single mode for one agent, chain mode for scout->editor workflows.
3. For recon: agent='scout' or agent='researcher', task='<what to find or analyze>'.
4. For editing: agent='editor', task='<specific change with file paths and context>'.
5. For scout+edit workflow: chain=[{agent:'scout', task:'find X'}, {agent:'editor', task:'based on {previous}, change Y'}].
6. The subagent runs in an isolated pi subprocess with its own context window.
7. Only the concise summary result is returned to the main context.

## Pitfalls
- Do not pass vague tasks — be specific about files, functions, or behaviors to find/change.
- The editor agent needs enough context in the task description since it has no prior conversation history.
- Use scout first if you don't know which files to edit, so the editor gets precise file paths.
- agentScope defaults to 'user' — project-local agents need agentScope:'both' or 'project'.
- **Always use the full provider-prefixed model ID in agent frontmatter** (e.g. `foundry/claude-sonnet-4-6`, not just `claude-sonnet-4-6`). The subprocess resolves models independently and will fall back to the built-in anthropic provider if the prefix is missing, causing "No API key found for anthropic" errors.
## Verification
1. After /reload, the subagent tool appears in the available tools list.
2. Run: use scout to find CMakeLists.txt files — should return file list without loading files into main context.
3. Check that main context usage stays low after delegation.