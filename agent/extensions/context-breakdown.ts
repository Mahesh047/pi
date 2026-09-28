import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { BuildSystemPromptOptions, ExtensionAPI, SlashCommandInfo } from "@earendil-works/pi-coding-agent";

type PromptSnapshot = {
	timestamp: number;
	systemPrompt: string;
	systemPromptOptions: BuildSystemPromptOptions;
};

function uniq(values: string[]): string[] {
	return [...new Set(values)];
}

function walkUpDirs(start: string): string[] {
	const dirs: string[] = [];
	let current = resolve(start);
	while (true) {
		dirs.push(current);
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return dirs;
}

function findExisting(paths: string[]): string[] {
	return paths.filter((p) => existsSync(p));
}

function formatList(items: string[], empty = "(none)"): string {
	return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : empty;
}

function getCommandPaths(commands: SlashCommandInfo[], source: "prompt" | "skill" | "extension"): string[] {
	return uniq(
		commands
			.filter((c) => c.source === source)
			.map((c) => c.sourceInfo.path)
			.filter((p): p is string => typeof p === "string" && p.length > 0),
	);
}

function getCommandNames(commands: SlashCommandInfo[], source: "prompt" | "skill" | "extension"): string[] {
	return uniq(commands.filter((c) => c.source === source).map((c) => `/${c.name}`));
}

function summarizePromptOptions(snapshot?: PromptSnapshot): string {
	if (!snapshot) {
		return [
			"_Detailed systemPromptOptions are not available yet in this extension instance._",
			"_Run one normal prompt after /reload, then run /context-breakdown again for a richer breakdown._",
		].join("\n");
	}

	const { systemPromptOptions: o } = snapshot;
	const lines: string[] = [];
	lines.push(`Captured at: ${new Date(snapshot.timestamp).toLocaleString()}`);
	lines.push("");
	lines.push("### Active tools");
	lines.push(formatList(o.selectedTools ?? []));
	lines.push("");
	lines.push("### Context files in prompt build");
	lines.push(formatList((o.contextFiles ?? []).map((f) => f.path)));
	lines.push("");
	lines.push("### Skills in prompt build");
	lines.push(formatList((o.skills ?? []).map((s) => `${s.name} — ${s.filePath}`)));
	lines.push("");
	lines.push("### Custom prompt / append state");
	lines.push(`- customPrompt present: ${o.customPrompt ? "yes" : "no"}`);
	lines.push(`- appendSystemPrompt present: ${o.appendSystemPrompt ? "yes" : "no"}`);
	lines.push(`- cwd in prompt build: ${o.cwd}`);
	return lines.join("\n");
}

function buildContextReport(pi: ExtensionAPI, snapshot: PromptSnapshot | undefined, cwd: string, ctx: Parameters<NonNullable<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>>[1]): string {
	const commands = pi.getCommands();
	const usage = ctx.getContextUsage();
	const prompt = ctx.getSystemPrompt();
	const globalAgentDir = join(homedir(), ".pi", "agent");

	const globalSystemFiles = findExisting([
		join(globalAgentDir, "SYSTEM.md"),
		join(globalAgentDir, "APPEND_SYSTEM.md"),
	]);
	const projectSystemFiles = findExisting([
		join(cwd, ".pi", "SYSTEM.md"),
		join(cwd, ".pi", "APPEND_SYSTEM.md"),
	]);

	const contextFileCandidates = walkUpDirs(cwd).flatMap((dir) => [join(dir, "AGENTS.md"), join(dir, "CLAUDE.md")]);
	const discoveredContextFiles = findExisting([join(globalAgentDir, "AGENTS.md"), ...contextFileCandidates]);

	const promptCommands = getCommandNames(commands, "prompt");
	const promptPaths = getCommandPaths(commands, "prompt");
	const skillCommands = getCommandNames(commands, "skill");
	const skillPaths = getCommandPaths(commands, "skill");
	const extensionCommands = getCommandNames(commands, "extension");
	const extensionPaths = getCommandPaths(commands, "extension");

	const report = [
		"# Context Breakdown",
		"",
		"## Current session",
		`- cwd: ${cwd}`,
		`- session file: ${ctx.sessionManager.getSessionFile() ?? "(ephemeral / unavailable)"}`,
		`- session id: ${ctx.sessionManager.getSessionId()}`,
		`- model: ${ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "(none selected)"}`,
		usage
			? `- context usage: ${usage.tokens} tokens${usage.maxTokens ? ` / ${usage.maxTokens}` : ""}`
			: "- context usage: (unavailable)",
		"",
		"## Effective system prompt",
		`- length: ${prompt.length} chars`,
		`- full prompt: use /show-system-prompt`,
		"",
		"## System prompt source files on disk",
		"### Project-local",
		formatList(projectSystemFiles),
		"",
		"### Global",
		formatList(globalSystemFiles),
		"",
		"## Context files discovered on disk",
		formatList(discoveredContextFiles),
		"",
		"## Last captured prompt-build breakdown",
		summarizePromptOptions(snapshot),
		"",
		"## Prompt templates available in this session",
		formatList(promptCommands),
		"",
		"### Prompt template source paths",
		formatList(promptPaths),
		"",
		"## Skill commands available in this session",
		formatList(skillCommands),
		"",
		"### Skill source paths",
		formatList(skillPaths),
		"",
		"## Extension commands available in this session",
		formatList(extensionCommands),
		"",
		"### Extension command source paths",
		formatList(extensionPaths, "(none with source paths)"),
		"",
		"> Note: extensions without registered slash commands may not appear above.",
		"> Also note: ctx.getSystemPrompt() shows Pi's current effective system prompt, but not later context-message mutations or before_provider_request payload rewrites.",
	].join("\n");

	return report;
}

export default function contextBreakdownExtension(pi: ExtensionAPI) {
	let lastSnapshot: PromptSnapshot | undefined;

	pi.on("before_agent_start", async (event) => {
		lastSnapshot = {
			timestamp: Date.now(),
			systemPrompt: event.systemPrompt,
			systemPromptOptions: event.systemPromptOptions,
		};
	});

	pi.registerCommand("context-breakdown", {
		description: "Load a breakdown of the current session context into the editor",
		handler: async (_args, ctx) => {
			const report = buildContextReport(pi, lastSnapshot, ctx.cwd, ctx);
			ctx.ui.setEditorText(report);
			ctx.ui.notify("Context breakdown loaded into the editor.", "info");
		},
	});

	pi.registerCommand("show-system-prompt", {
		description: "Load the current effective system prompt into the editor",
		handler: async (_args, ctx) => {
			const prompt = ctx.getSystemPrompt();
			const header = [
				"# Effective System Prompt",
				"",
				`- length: ${prompt.length} chars`,
				lastSnapshot ? `- last prompt-build snapshot: ${new Date(lastSnapshot.timestamp).toLocaleString()}` : "- last prompt-build snapshot: unavailable in this extension instance",
				"",
				"> Note: this is Pi's current effective system prompt string.",
				"> It does not include later context-message mutations or before_provider_request payload rewrites.",
				"",
			].join("\n");
			ctx.ui.setEditorText(`${header}${prompt}`);
			ctx.ui.notify("System prompt loaded into the editor.", "info");
		},
	});
}
