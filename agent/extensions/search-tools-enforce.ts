import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Enforces the use of fd, rg (ripgrep), and fzf for all search and file discovery
 * operations in every session across all projects.
 */
export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, _ctx) => {
    const instruction = `
## Search & File Discovery Tools (enforced)
Always use these tools instead of \`find\`, \`grep\`, or bare \`ls\` for file search and content search:
- **fd** — find files by name, type, or extension: \`fd -e c\`, \`fd 'pattern'\`, \`fd --type f\`
- **rg** (ripgrep) — search file contents: \`rg 'pattern'\`, \`rg 'pattern' --type c -l\`, \`rg --files -g '*.h'\`
- **fzf** — interactive fuzzy selection (only in interactive/manual contexts, not scripted bash): \`fd -e c | fzf\`, \`rg -l 'sym' | fzf\`

Do NOT use \`find\`, \`grep\`, or \`dir\` when fd or rg can do the job.
Both fd and rg respect .gitignore by default — add \`--no-ignore\` to search build/vendor dirs.
`;
    return {
      systemPrompt: event.systemPrompt + instruction,
    };
  });
}
