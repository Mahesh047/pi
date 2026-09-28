---
name: "multi-agent-hats"
description: "Orchestrate a team of specialized pi agents (Planner, Coder, Tester, Reviewer, Documenter) that communicate via the coms extension."
version: 3
created: "2026-07-09"
updated: "2026-07-09"
---
## When to Use
Use when a task benefits from specialised roles working in parallel or sequence — e.g. plan → implement → test → review → document. Each role runs as an independent pi session wearing a "hat" (a system-prompt persona). The Orchestrator agent coordinates all others via the coms extension.

## Procedure
1. **LAUNCH ALL AGENTS** with the included PowerShell launcher (requires Windows Terminal):

   ```powershell
   # From your project directory — opens 6 colour-coded WT tabs automatically
   pwsh $env:USERPROFILE\.pi\agent\pi-hermes-memory\skills\multi-agent-hats\launch.ps1

   # Explicit project name
   pwsh ...\launch.ps1 -Project alsmart

   # Restart only specific agents (others already running)
   pwsh ...\launch.ps1 -Only Tester,Reviewer
   ```

   To launch manually without the script, open one terminal per agent:
   ```powershell
   pi -e $env:USERPROFILE\.pi\agent\extensions\coms.ts `
      --project <project> `
      --append-system-prompt $env:USERPROFILE\.pi\agent\pi-hermes-memory\skills\multi-agent-hats\agents\<role>.md
   ```

2. **VERIFY POOL** — In the Orchestrator tab call `coms_list`. All 5 hat-agents should appear with a live context-% bar (not `--`).

3. **DELEGATE FROM THE ORCHESTRATOR** — The user talks only to the Orchestrator. It delegates using `coms_send` + `coms_await`:

   ```
   1. coms_send  → Planner     (goal description — ask for a step-by-step plan)
   2. coms_await ← Planner     (receive the numbered plan)
   3. coms_send  → Coder       (full plan — ask for implementation)
   4. coms_await ← Coder       (receive implementation summary)
   5. coms_send  → Tester      (implementation summary — ask for tests + results)
   6. coms_await ← Tester      (receive test report)
   7. coms_send  → Reviewer    (code summary + test report — ask for review)
   8. coms_await ← Reviewer    (receive review verdict)
   9. coms_send  → Documenter  (implementation + review feedback — ask for docs)
   10. coms_await ← Documenter (receive documentation summary)
   11. Synthesise all results for the user.
   ```

4. **ADD A NEW HAT** — Copy any existing `agents/<role>.md`, update the frontmatter `name`/`color`/`description`, write the new persona body, and add a matching entry to the `$agents` array in `launch.ps1`. Re-run the launcher or start the new agent manually.
## Pitfalls
- All agents MUST share the same --project value or they will not see each other via coms_list.
- Launch hat-agents BEFORE sending any task to the Orchestrator. If an agent is offline, coms_await will block until PI_COMS_TIMEOUT_MS (default 30 min) then error.
- The coms extension uses --cname (not --name) to override the agent's display name. --name is reserved by pi for session resumption.
- Hop limit is 5 by default (PI_COMS_MAX_HOPS). The Orchestrator→Hat path is 1 hop; avoid chaining hats together or you may hit the limit.
- Each hat-agent must stay idle (not streaming) to receive the inbound prompt. Do not send tasks to an agent that is already processing one.
- On Windows, endpoints are named pipes (\\.\ pipe\pi-coms-<id>). Firewall or AV software usually does not block these but check if coms_list returns no peers.

## Verification
1. In the Orchestrator terminal: coms_list shows all 5 hat-agents with a live context % (not '--').
2. Send a small test task to the Orchestrator. Confirm it calls coms_send → Planner and coms_await responds.
3. Check the coms pool widget below the editor — each agent appears as a coloured dot with its name.