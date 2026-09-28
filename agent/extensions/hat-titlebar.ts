/**
 * hat-titlebar
 *
 * Titlebar extension for hat agents launched via the multi-agent-hats skill.
 * Reads the agent's name from the --append-system-prompt frontmatter and uses
 * it as the persistent tab title, with a braille spinner while the agent works.
 *
 * This replaces --suppressApplicationTitle (which blocks ALL title updates,
 * including the spinner) with a smarter approach: the extension owns the title
 * itself and resets it to the role name after every turn.
 */

import fs from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function readAgentName(argv: string[]): string | null {
	for (const flag of ["--append-system-prompt", "--system-prompt"]) {
		const idx = argv.indexOf(flag);
		if (idx < 0 || idx + 1 >= argv.length) continue;
		try {
			const raw = fs.readFileSync(argv[idx + 1], "utf-8");
			const m = raw.match(/^---[\s\S]*?^name:\s*["']?(.+?)["']?\s*$/m);
			if (m) return m[1].trim();
		} catch {
			// file unreadable — fall through
		}
	}
	return null;
}

export default function (pi: ExtensionAPI) {
	const agentName = readAgentName(process.argv);
	if (!agentName) return; // not a hat agent, do nothing

	let timer: ReturnType<typeof setInterval> | null = null;
	let frame = 0;

	function setIdle(ctx: ExtensionContext) {
		if (timer) { clearInterval(timer); timer = null; }
		frame = 0;
		ctx.ui.setTitle(agentName);
	}

	function setSpin(ctx: ExtensionContext) {
		if (timer) clearInterval(timer);
		frame = 0;
		timer = setInterval(() => {
			ctx.ui.setTitle(`${FRAMES[frame % FRAMES.length]} ${agentName}`);
			frame++;
		}, 80);
	}

	pi.on("session_start",    async (_e, ctx) => setIdle(ctx));
	pi.on("agent_start",      async (_e, ctx) => setSpin(ctx));
	pi.on("agent_end",        async (_e, ctx) => setIdle(ctx));
	pi.on("session_shutdown", async (_e, ctx) => setIdle(ctx));
}
