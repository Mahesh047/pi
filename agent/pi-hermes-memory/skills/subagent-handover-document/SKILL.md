---
name: "subagent-handover-document"
description: "Bidirectional handover document protocol for sub-agents: outbound briefing and inbound return, both via temp files that are read-then-deleted."
version: 2
created: "2026-06-15"
updated: "2026-06-15"
---
## When to Use
Every time a sub-agent is spawned via the subagent tool. Both the briefing (main → agent) and the result (agent → main) travel through handover documents. Neither side inlines large content.

## Procedure
1. Before calling the subagent tool, write a handover document to `.pi/handover/handover.md`. For parallel agents use unique names: `handover_scout.md`, `handover_editor.md`, etc.
2. Use this outbound structure:
```
# Handover
## Goal
<one or two sentences>
## Context
- <bullet points — only what the agent needs>
## Constraints
- <rules, conventions, files to avoid>
## Expected Output
<what the agent must produce or do>
## Return File
<path the agent must write its return doc to, e.g. .pi/handover/return.md>
```
3. Start the subagent task string with: 'Read and delete `.pi/handover/handover.md` (use the bash tool: `cat` then `rm`), then proceed with the task described in it.'
4. The sub-agent must write a return handover doc to the path specified in `## Return File` before it finishes. Return doc structure:
```
# Return Handover
## Status
<done | partial | failed>
## Findings
- <bullet points>
## Artifacts
- <files created/modified, or 'none'>
## Notes
<warnings, caveats, follow-up suggestions>
```
5. After the agent completes, read and delete the return handover file. Incorporate its findings into your response.
6. Verify `.pi/handover/` is empty. Clean up any stale files manually if an agent failed mid-run.

## Pitfalls
- Do not put large file contents or full code listings in either handover doc — reference file paths instead.
- Do not reuse the same filename for parallel agents. Match inbound and return filenames (e.g. handover_scout.md → return_scout.md).
- If the agent fails before writing the return doc, the main agent must handle the missing file gracefully.
- If the agent fails before reading the inbound doc, it will persist — always clean up stale files before the next run.
- The `.pi/handover/` directory should be in .gitignore.

## Verification
1. After the subagent completes, the inbound handover file no longer exists (agent deleted it).
2. The return handover file exists and follows the Status / Findings / Artifacts / Notes structure.
3. After the main agent reads the return doc, the return file is deleted and `.pi/handover/` is empty.