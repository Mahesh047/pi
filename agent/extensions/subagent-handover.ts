import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HANDOVER_INSTRUCTIONS = `
## Sub-agent handover document protocol

Communication between the main agent and sub-agents flows through handover documents in both directions. Both the outbound briefing and the inbound return must use this mechanism.

### Outbound: before spawning a sub-agent

Every time you spawn a sub-agent via the \`subagent\` tool, you MUST:

1. **Write a handover document first** to \`.pi/handover/handover.md\` (relative to the working directory). Create the directory if it does not exist. For parallel agents use unique filenames: \`handover_scout.md\`, \`handover_editor.md\`, etc.

2. **Keep the document concise.** Use exactly this structure:
   \`\`\`
   # Handover
   ## Goal
   <one or two sentences>
   ## Context
   - <bullet points — only what the agent needs>
   ## Constraints
   - <rules, conventions, files to avoid, etc.>
   ## Expected Output
   <what the agent must produce or do>
   ## Return File
   <filename the agent must write its return handover to, e.g. .pi/handover/return.md>
   \`\`\`
   Do NOT put large file contents or full code listings in the handover doc.

3. **Start the subagent task string with:** "Read and delete \`.pi/handover/handover.md\` (use the bash tool: \`cat\` then \`rm\`), then proceed with the task described in it."

4. **After the agent completes**, read and delete the return handover file it wrote (see Inbound section below). If the return file is missing, treat it as a protocol error.

---

### Inbound: how a sub-agent must return its results

When you are a sub-agent, after completing your task you MUST:

1. **Write a return handover document** to the path specified in the \`## Return File\` section of the briefing you received (default: \`.pi/handover/return.md\`). For parallel agents use the unique return filename that matches your inbound briefing.

2. **Keep the return document concise.** Use exactly this structure:
   \`\`\`
   # Return Handover
   ## Status
   <done | partial | failed>
   ## Findings
   - <bullet points — key results, discoveries, or outputs>
   ## Artifacts
   - <files created or modified, if any — otherwise "none">
   ## Notes
   <anything the main agent must know — warnings, caveats, follow-up suggestions>
   \`\`\`

3. **Do NOT inline large outputs** into the return doc. Reference file paths instead.

4. After writing the return doc, your task is complete. Do not delete it — the main agent reads and deletes it.

---

### Cleanup rules

- The \`.pi/handover/\` directory must stay clean between runs.
- After reading any handover file (inbound or return), delete it immediately.
- If an agent fails before writing its return doc, the main agent must handle the missing file gracefully and clean up any stale inbound doc manually.
`;

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, _ctx) => {
    return {
      systemPrompt: event.systemPrompt + HANDOVER_INSTRUCTIONS,
    };
  });
}
