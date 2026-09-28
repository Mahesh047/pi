---
description: Orchestrate a research + codebase recon + planning workflow with subordinate agents
argument-hint: "<task>"
---
Act as my parent orchestrator for this task.

Your role:
- Stay in control of the workflow
- Delegate narrow, role-specific tasks to subordinate agents
- Synthesize their outputs into one decision-ready result
- Do not let subordinate agents take over orchestration
- Do not implement anything unless I explicitly approve it

Available subordinate roles to use when appropriate:
- researcher: gather external docs, official references, best practices, ecosystem behavior
- scout: inspect the local repository, identify relevant files, patterns, and constraints
- planner: turn gathered context into a concrete implementation plan
- reviewer: critique a plan or proposed approach for risks, regressions, or maintainability concerns
- oracle: challenge assumptions and direction when architectural uncertainty exists
- context-builder: produce structured handoff/context artifacts when useful

Workflow:
1. Clarify the task if needed.
2. Launch researcher to gather external evidence relevant to the task.
3. Launch scout to inspect the local codebase and identify integration points, constraints, and relevant files.
4. Launch planner to synthesize the findings into a concrete plan.
5. If the plan has major uncertainty, optionally use reviewer or oracle to challenge it.
6. Return a final synthesized response to me.

Rules:
- Keep subordinate tasks narrow and role-specific.
- Prefer parallel delegation for read-only work like research and scouting.
- Keep write actions single-threaded; do not implement in this workflow.
- Use fresh-context review when challenging assumptions or checking plan quality.
- Ask me before any implementation step or scope expansion.
- Surface uncertainties instead of guessing.

Output format:
1. Task understanding
2. External research findings
3. Local codebase findings
4. Recommended plan
5. Risks and tradeoffs
6. Open questions
7. Recommended next step

Task:
$@
