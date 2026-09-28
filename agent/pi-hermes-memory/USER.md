For embedded/bootloader work, be concise and safety-aware: ask clarifying questions when requirements or safety constraints are unclear, but for live investigation act directly with available tools; stream long dumps incrementally; scan OSPI for populated sectors before dumping; keep GDB/helper temp files out of the repo; when changing bootloader code, add relevant tests, starting with pure logic/data-layout tests behind thin stubbed flash-driver interfaces. <!-- created=2026-06-08, last=2026-09-27 -->
§
Workflow/response preferences: use fd/rg/fzf for discovery; when delegating prefer coms agents if requested/available, otherwise a concise temp handover file the subagent reads and deletes first; for Warp terminal work, check docs/config first and prefer documented features over ad-hoc UI automation; for document/PDF ingestion, prefer Markdown with structured tables and AI-understandable diagram descriptions; for update-flow testing, retain uploaded/extracted update files between attempts; respond extremely concisely, always state exact tool/compiler/library/CMake/dependency versions, never say 'latest', run the repo's configured build/task yourself before claiming buildability or a build-related fix, and for nontrivial or cleanup/revert changes give an exact keep/remove plan first and keep diffs minimal vs main. <!-- created=2026-06-15, last=2026-09-27 -->
§
Implementation preferences: keep code simple and readable with sensible functional splits, shared BSP/SDK symbolic defines instead of magic numbers, very sparse comments, and explicit TODOs for provisional values; do not hand-edit generated/vendor/config/RA-FSP files, prefer disabling unused generated entries in place over deleting when that preserves structure, avoid ad-hoc wrappers/override files, match the reference project's generated/build-system approach, use human-facing development/production labels where possible without changing required internal/tool names, and verify actual peripherals/hardware from ra_gen/hal_data.* before adding drivers, abstractions, or helper layers. <!-- created=2026-08-19, last=2026-09-27 -->
§
User prefers analysis/recommendations first and explicit approval before any code, config, file, or git add/commit/push changes; if multiple repos are involved, only push the specifically named repo. <!-- created=2026-09-27, last=2026-09-27 -->
§
Embedded preference: don't invent peripherals/hardware; confirm them from `ra_gen/hal_data.*` or a known-good reference project before adding code. <!-- created=2026-09-27, last=2026-09-27 -->
§
In embedded/bootloader work, the user expects hardware and peripheral assumptions to be verified against generated project files (for example ra_gen/hal_data) or a reference project; do not invent missing hardware/peripherals. <!-- created=2026-09-27, last=2026-09-27 -->
§
For embedded/bootloader changes, do not make code changes without asking first; if a change is needed, explain it and get approval before performing it. Also avoid inventing hardware/peripherals—verify they exist in the generated project or a reference project first. <!-- created=2026-09-27, last=2026-09-27 -->
§
In embedded/bootloader hardware work, verify actual configured peripherals from generated FSP/ra_gen files before adding code; do not invent hardware or assume peripherals that are not configured. <!-- created=2026-09-27, last=2026-09-27 -->
§
Prefers pi default thinking level "medium" (set defaultThinkingLevel in ~/.pi/agent/settings.json; changed from high). <!-- created=2026-09-28, last=2026-09-28 -->
§
Never run git commit without explicit user instruction. Make file changes freely, but always wait for the user to say "commit" or equivalent before committing. <!-- created=2026-09-28, last=2026-09-28 -->
§
Wants source edited directly with the edit tool; do not write helper .py/edit scripts (even temporary) to apply changes. Keep scope to exactly what was asked. <!-- created=2026-09-28, last=2026-09-28 -->