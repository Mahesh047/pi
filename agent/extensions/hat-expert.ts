/**
 * hat-expert
 *
 * Registers /launch-expert <topic> as a slash command for the Orchestrator.
 * Generates a dynamic expert system prompt, writes a temp launcher, and opens
 * a new Windows Terminal tab — no LLM turn, no bash tool required.
 */

import { execFile }  from "node:child_process";
import crypto        from "node:crypto";
import fs            from "node:fs";
import os            from "node:os";
import path          from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── Palette — deterministic colour per topic ──────────────────────────────────

const PALETTE = [
	"#4D9DE0", "#E15554", "#E1BC29", "#3BB273",
	"#7768AE", "#FFAA8B", "#FF6B6B", "#4ECDC4",
	"#F7B731", "#A55EEA", "#26C281", "#FC5C65",
];

function slugify(topic: string): string {
	return topic
		.split(/\s+/)
		.filter((w) => w.length > 0)
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join("");
}

function pickColor(topic: string): string {
	const hash = crypto.createHash("sha256").update(topic.toLowerCase()).digest("hex");
	return PALETTE[parseInt(hash.slice(0, 8), 16) % PALETTE.length];
}

function readArgvFlag(flag: string): string | null {
	const idx = process.argv.indexOf(flag);
	if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
	return null;
}

function cleanup(...files: string[]): void {
	for (const f of files) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.registerCommand("launch-expert", {
		description: "Launch a topic-specialist Expert agent into the coms pool. Usage: /launch-expert <topic>",

		handler: async (args, ctx) => {
			const topic = (args ?? "").trim();
			if (!topic) {
				ctx.ui.notify("Usage: /launch-expert <topic>  e.g. /launch-expert FreeRTOS", "warning");
				return;
			}

			const slug      = slugify(topic);
			const color     = pickColor(topic);
			const agentName = `Expert-${slug}`;
			const tabTitle  = `Expert-${slug} - ${topic}`;   // plain ASCII title — no emoji quoting issues
			const project   = readArgvFlag("--project") ?? path.basename(process.cwd());
			const cwd       = ctx.cwd ?? process.cwd();
			const timeoutMs = 60 * 60 * 1000;

			const agentDir    = path.join(os.homedir(), ".pi", "agent");
			const ext         = path.join(agentDir, "extensions", "coms.ts");
			const hatTitlebar = path.join(agentDir, "extensions", "hat-titlebar.ts");
			const tempDir     = os.tmpdir();
			const uid         = `${slug}-${Date.now()}`;
			const promptPath  = path.join(tempDir, `expert-prompt-${uid}.md`);
			const launcherPath = path.join(tempDir, `expert-launcher-${uid}.ps1`);

			// ── Verify extensions exist ───────────────────────────────────────
			for (const p of [ext, hatTitlebar]) {
				if (!fs.existsSync(p)) {
					ctx.ui.notify(`Extension not found: ${p}`, "error");
					return;
				}
			}

			// ── Dynamic system prompt ─────────────────────────────────────────
			fs.writeFileSync(promptPath, [
				"---",
				`name: ${agentName}`,
				`description: Specialist in ${topic}`,
				`color: "${color}"`,
				"---",
				"",
				`# Expert: ${topic}`,
				"",
				`You are a **${topic} specialist** in a multi-agent pi team. The Orchestrator delegates tasks to you because you have deep, focused expertise in **${topic}**.`,
				"",
				"## Your role",
				"",
				`Handle every request within **${topic}** completely and autonomously using all available tools (read, bash, edit, write).`,
				"",
				"## What you do",
				"",
				`- Answer questions about ${topic} with authority and precision`,
				`- Implement, configure, or fix anything specific to ${topic}`,
				`- Review code or designs for ${topic}-specific correctness and best practices`,
				`- Diagnose and resolve issues related to ${topic}`,
				"",
				"## What you don't do",
				"",
				`- Do not handle topics outside ${topic} — tell the Orchestrator to route those elsewhere`,
				"- Do not coordinate other agents — that is the Orchestrator's job",
				"",
				"## Response format",
				"",
				"End every response with a short **Summary** block:",
				"",
				"```",
				"## Summary",
				"<what you did or found — 2-4 sentences>",
				"```",
			].join("\n"), "utf-8");

			// ── Temp launcher script ──────────────────────────────────────────
			const esc = (s: string) => s.replace(/'/g, "''");
			fs.writeFileSync(launcherPath, [
				`$env:PI_COMS_TIMEOUT_MS = '${timeoutMs}'`,
				`Set-Location '${esc(cwd)}'`,
				"try {",
				`    pi -e '${esc(ext)}' \``,
				`       -e '${esc(hatTitlebar)}' \``,
				`       --project '${esc(project)}' \``,
				`       --append-system-prompt '${esc(promptPath)}'`,
				"} finally {",
				`    Remove-Item -LiteralPath '${esc(promptPath)}'    -ErrorAction SilentlyContinue`,
				`    Remove-Item -LiteralPath '${esc(launcherPath)}' -ErrorAction SilentlyContinue`,
				"}",
			].join("\n"), "utf-8");

			// ── Launch via execFile so errors surface ─────────────────────────
			// wt.exe is called directly with an args array — no shell quoting needed.
			const wtExe = path.join(
				process.env.LOCALAPPDATA ?? "",
				"Microsoft", "WindowsApps", "wt.exe",
			);

			const wtArgs = [
				"new-tab",
				"--title",    tabTitle,
				"--tabColor", color,
				"pwsh", "-NoExit", "-File", launcherPath,
			];

			execFile(wtExe, wtArgs, (err, _stdout, stderr) => {
				if (err) {
					cleanup(promptPath, launcherPath);
					ctx.ui.notify(
						`Failed to open Windows Terminal: ${stderr.trim() || err.message}`,
						"error",
					);
					return;
				}
				ctx.ui.notify(
					`Launched ${agentName} (${topic}) — run coms_list to confirm it joined the pool`,
					"info",
				);
			});
		},
	});
}
