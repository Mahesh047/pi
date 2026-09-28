import fs from "node:fs";
import path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { CURSOR_MARKER, matchesKey, truncateToWidth, visibleWidth, type Focusable } from "@earendil-works/pi-tui";

type DashboardBlock = {
	id?: string;
	title: string;
	subtitle?: string;
	command?: string;
};

type DashboardConfig = {
	title: string;
	columns: number;
	blocks: DashboardBlock[];
};

const CONFIG_PATH = path.join(__dirname, "blocks.yaml");
const DEFAULT_TITLE = "YAML Dashboard";
const DEFAULT_COLUMNS = 3;
const VISIBLE_GRID_ROWS = 3;

export default function (pi: ExtensionAPI) {
	const openDashboard = async (args: string, ctx: ExtensionCommandContext) => {
		let config: DashboardConfig;
		try {
			config = loadDashboardConfig(CONFIG_PATH);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Dashboard config error: ${message}`, "error");
			return;
		}

		const requested = Number.parseInt(args.trim(), 10);
		const initialSelection =
			Number.isFinite(requested) && requested >= 1 && requested <= config.blocks.length ? requested - 1 : 0;
		const minWidth = Math.max(60, config.columns * 18 + (config.columns - 1) * 2 + 2);

		const selected = await ctx.ui.custom<number | undefined>(
			(_tui, theme, _keybindings, done) => new DashboardComponent(theme, done, config, initialSelection),
			{
				overlay: true,
				overlayOptions: {
					anchor: "center",
					width: "90%",
					minWidth,
					maxHeight: 28,
					margin: 1,
				},
			},
		);

		if (selected !== undefined) {
			const block = config.blocks[selected]!;
			const label = block.id ? `${block.title} (${block.id})` : block.title;
			ctx.ui.notify(`Activated ${label}`, "info");
		}
	};

	const getCompletions = (prefix: string) => {
		try {
			const config = loadDashboardConfig(CONFIG_PATH);
			const trimmed = prefix.trim();
			const items = config.blocks.map((block, index) => ({
				value: String(index + 1),
				label: `${index + 1}: ${block.title}`,
			}));
			const filtered = items.filter((item) => item.value.startsWith(trimmed));
			return filtered.length > 0 ? filtered : null;
		} catch {
			return null;
		}
	};

	for (const name of ["dashboard", "grid", "grid6"]) {
		pi.registerCommand(name, {
			description: `Open the YAML-driven dashboard (${path.basename(CONFIG_PATH)})`,
			getArgumentCompletions: getCompletions,
			handler: openDashboard,
		});
	}
}

class DashboardComponent implements Focusable {
	focused = false;

	private query = "";
	private filteredIndices: number[] = [];
	private selectedFilteredIndex = -1;
	private scrollRowOffset = 0;

	constructor(
		private readonly theme: Theme,
		private readonly done: (result: number | undefined) => void,
		private readonly config: DashboardConfig,
		initialSelection = 0,
	) {
		this.refreshFilter(initialSelection);
	}

	handleInput(data: string): void {
		if (matchesKey(data, "ctrl+c") || data === "q" || data === "Q") {
			this.done(undefined);
			return;
		}

		if (matchesKey(data, "escape")) {
			if (this.query.length > 0) {
				this.query = "";
				this.refreshFilter();
			} else {
				this.done(undefined);
			}
			return;
		}

		if (matchesKey(data, "return")) {
			const selected = this.getSelectedOriginalIndex();
			if (selected !== undefined) this.done(selected);
			return;
		}

		if (matchesKey(data, "backspace") || matchesKey(data, "delete")) {
			if (this.query.length > 0) {
				this.query = this.query.slice(0, -1);
				this.refreshFilter();
			}
			return;
		}

		if (matchesKey(data, "ctrl+u")) {
			if (this.query.length > 0) {
				this.query = "";
				this.refreshFilter();
			}
			return;
		}

		if (matchesKey(data, "home")) {
			if (this.filteredIndices.length > 0) {
				this.selectedFilteredIndex = 0;
				this.ensureSelectionVisible();
			}
			return;
		}

		if (matchesKey(data, "end")) {
			if (this.filteredIndices.length > 0) {
				this.selectedFilteredIndex = this.filteredIndices.length - 1;
				this.ensureSelectionVisible();
			}
			return;
		}

		if (matchesKey(data, "up")) {
			if (this.selectedFilteredIndex >= 0) {
				this.selectedFilteredIndex = Math.max(0, this.selectedFilteredIndex - this.config.columns);
				this.ensureSelectionVisible();
			}
			return;
		}

		if (matchesKey(data, "down")) {
			if (this.selectedFilteredIndex >= 0) {
				this.selectedFilteredIndex = Math.min(this.filteredIndices.length - 1, this.selectedFilteredIndex + this.config.columns);
				this.ensureSelectionVisible();
			}
			return;
		}

		if (matchesKey(data, "left")) {
			if (this.selectedFilteredIndex >= 0) {
				this.selectedFilteredIndex = Math.max(0, this.selectedFilteredIndex - 1);
				this.ensureSelectionVisible();
			}
			return;
		}

		if (matchesKey(data, "right")) {
			if (this.selectedFilteredIndex >= 0) {
				this.selectedFilteredIndex = Math.min(this.filteredIndices.length - 1, this.selectedFilteredIndex + 1);
				this.ensureSelectionVisible();
			}
			return;
		}

		if (data.length === 1 && data.charCodeAt(0) >= 32) {
			this.query += data;
			this.refreshFilter();
		}
	}

	render(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const lines: string[] = [];
		const outerRow = (content: string) =>
			this.theme.fg("border", "│") + padAnsi(content, innerWidth) + this.theme.fg("border", "│");

		lines.push(this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`));
		lines.push(outerRow(` ${this.theme.fg("accent", this.config.title)}`));
		lines.push(
			outerRow(
				` ${this.theme.fg("dim", `${this.config.blocks.length} blocks • ${this.config.columns} columns • fixed-size window • scrollable rows`)}`,
			),
		);
		lines.push(outerRow(this.renderSearchLine(innerWidth)));
		lines.push(
			outerRow(
				` ${this.theme.fg("dim", "Type to fuzzy filter • arrows move • Enter activate • Backspace delete • Ctrl+U clear • Esc clear/close")}`,
			),
		);
		lines.push(outerRow(""));

		if (innerWidth < 30) {
			lines.push(outerRow(` ${this.theme.fg("warning", "Terminal too narrow for dashboard rendering.")}`));
			lines.push(this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`));
			return lines;
		}

		for (const line of this.renderVisibleGridArea(innerWidth)) {
			lines.push(outerRow(line));
		}

		lines.push(outerRow(""));
		lines.push(outerRow(` ${this.theme.fg("success", this.renderFooterStatus())}`));
		lines.push(this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`));
		return lines;
	}

	invalidate(): void {}
	dispose(): void {}

	private renderSearchLine(width: number): string {
		const label = this.theme.fg("accent", " Search: ");
		const marker = this.focused ? CURSOR_MARKER : "";
		const queryText = this.query.length > 0 ? this.query : this.theme.fg("dim", "type to filter blocks...");
		return truncateToWidth(`${label}${queryText}${marker}\x1b[7m \x1b[27m`, Math.max(1, width - 1), "", true);
	}

	private renderFooterStatus(): string {
		const selectedOriginal = this.getSelectedOriginalIndex();
		const matchCount = this.filteredIndices.length;
		const totalRows = Math.max(1, Math.ceil(matchCount / this.config.columns));
		const visibleStart = matchCount === 0 ? 0 : this.scrollRowOffset + 1;
		const visibleEnd = matchCount === 0 ? 0 : Math.min(totalRows, this.scrollRowOffset + VISIBLE_GRID_ROWS);

		if (selectedOriginal === undefined) {
			return `No matches • rows ${visibleStart}-${visibleEnd} of ${totalRows}`;
		}

		const block = this.config.blocks[selectedOriginal]!;
		const name = block.command ? `${block.title} • ${block.command}` : block.title;
		return `${matchCount} match${matchCount === 1 ? "" : "es"} • rows ${visibleStart}-${visibleEnd} of ${totalRows} • ${name}`;
	}

	private renderVisibleGridArea(totalWidth: number): string[] {
		const lines: string[] = [];
		const rowCount = VISIBLE_GRID_ROWS;

		for (let displayRow = 0; displayRow < rowCount; displayRow++) {
			const absoluteRow = this.scrollRowOffset + displayRow;
			const rowSlots = Array.from({ length: this.config.columns }, (_, colIndex) => {
				const filteredPosition = absoluteRow * this.config.columns + colIndex;
				return filteredPosition < this.filteredIndices.length ? this.filteredIndices[filteredPosition]! : null;
			});

			for (const line of this.renderGridRow(totalWidth, rowSlots)) {
				lines.push(line);
			}

			if (displayRow < rowCount - 1) {
				lines.push("");
			}
		}

		return lines;
	}

	private renderGridRow(totalWidth: number, slots: Array<number | null>): string[] {
		const gap = 2;
		const cellWidths = splitWidths(totalWidth - gap * Math.max(0, this.config.columns - 1), this.config.columns);
		const cells = slots.map((originalIndex, i) => this.renderCell(originalIndex, cellWidths[i]!));
		const rowHeight = Math.max(...cells.map((cell) => cell.length));
		const spacer = " ".repeat(gap);
		const lines: string[] = [];

		for (let lineIndex = 0; lineIndex < rowHeight; lineIndex++) {
			lines.push(cells.map((cell) => cell[lineIndex]!).join(spacer));
		}

		return lines;
	}

	private renderCell(originalIndex: number | null, width: number): string[] {
		if (originalIndex === null) {
			return this.renderEmptyCell(width);
		}

		const block = this.config.blocks[originalIndex]!;
		const selected = this.getSelectedOriginalIndex() === originalIndex;
		const borderColor = selected ? "accent" : "border";
		const titleColor = selected ? "accent" : "text";
		const innerWidth = Math.max(1, width - 2);
		const border = (text: string) => this.theme.fg(borderColor, text);
		const row = (content: string) => border("│") + padAnsi(content, innerWidth) + border("│");
		const line1 = `${originalIndex + 1}. ${block.title}`;
		const line2 = block.subtitle ? this.theme.fg("dim", block.subtitle) : this.theme.fg("dim", block.id ?? "Placeholder");
		const line3 = selected
			? this.theme.fg("success", block.command ?? block.id ?? "ready")
			: this.theme.fg("dim", block.id ?? " ");

		return [
			border(`╭${"─".repeat(innerWidth)}╮`),
			row(` ${this.theme.fg(titleColor, line1)}`),
			row(` ${line2}`),
			row(` ${line3}`),
			border(`╰${"─".repeat(innerWidth)}╯`),
		];
	}

	private renderEmptyCell(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const border = (text: string) => this.theme.fg("borderMuted", text);
		const row = (content: string) => border("│") + padAnsi(content, innerWidth) + border("│");
		return [
			border(`╭${"─".repeat(innerWidth)}╮`),
			row(""),
			row(` ${this.theme.fg("dim", this.filteredIndices.length === 0 ? "No matching blocks" : "")}`),
			row(""),
			border(`╰${"─".repeat(innerWidth)}╯`),
		];
	}

	private refreshFilter(preferredOriginalIndex?: number): void {
		const desiredOriginalIndex = preferredOriginalIndex ?? this.getSelectedOriginalIndex() ?? 0;
		const ranked = this.config.blocks
			.map((block, originalIndex) => ({
				originalIndex,
				score: fuzzyScore(this.query, buildSearchText(block, originalIndex)),
			}))
			.filter((item): item is { originalIndex: number; score: number } => item.score !== null)
			.sort((a, b) => a.score - b.score || a.originalIndex - b.originalIndex);

		this.filteredIndices = ranked.map((item) => item.originalIndex);

		if (this.filteredIndices.length === 0) {
			this.selectedFilteredIndex = -1;
			this.scrollRowOffset = 0;
			return;
		}

		const desiredFilteredIndex = this.filteredIndices.indexOf(desiredOriginalIndex);
		this.selectedFilteredIndex = desiredFilteredIndex >= 0 ? desiredFilteredIndex : 0;
		this.ensureSelectionVisible();
	}

	private ensureSelectionVisible(): void {
		if (this.selectedFilteredIndex < 0) {
			this.scrollRowOffset = 0;
			return;
		}

		const selectedRow = Math.floor(this.selectedFilteredIndex / this.config.columns);
		if (selectedRow < this.scrollRowOffset) {
			this.scrollRowOffset = selectedRow;
		} else if (selectedRow >= this.scrollRowOffset + VISIBLE_GRID_ROWS) {
			this.scrollRowOffset = selectedRow - VISIBLE_GRID_ROWS + 1;
		}
	}

	private getSelectedOriginalIndex(): number | undefined {
		if (this.selectedFilteredIndex < 0 || this.selectedFilteredIndex >= this.filteredIndices.length) return undefined;
		return this.filteredIndices[this.selectedFilteredIndex];
	}
}

function loadDashboardConfig(configPath: string): DashboardConfig {
	const raw = fs.readFileSync(configPath, "utf8");
	const parsed = parseDashboardYaml(raw);
	if (parsed.blocks.length === 0) {
		throw new Error(`No blocks found in ${configPath}`);
	}
	return parsed;
}

function parseDashboardYaml(source: string): DashboardConfig {
	const config: DashboardConfig = {
		title: DEFAULT_TITLE,
		columns: DEFAULT_COLUMNS,
		blocks: [],
	};

	const lines = source.replace(/\r\n/g, "\n").split("\n");
	let inBlocks = false;
	let currentBlock: Partial<DashboardBlock> | null = null;

	const commitBlock = () => {
		if (!currentBlock) return;
		if (!currentBlock.title) {
			throw new Error("Each block in blocks.yaml must include a title");
		}
		config.blocks.push({
			id: currentBlock.id,
			title: currentBlock.title,
			subtitle: currentBlock.subtitle,
			command: currentBlock.command,
		});
		currentBlock = null;
	};

	for (const rawLine of lines) {
		const line = stripComment(rawLine).trimEnd();
		if (!line.trim()) continue;

		const trimmed = line.trimStart();
		if (!inBlocks) {
			if (trimmed === "blocks:") {
				inBlocks = true;
				continue;
			}
			const entry = parseKeyValue(trimmed);
			if (!entry) {
				throw new Error(`Unsupported YAML line: ${rawLine}`);
			}
			if (entry.key === "title") config.title = entry.value || DEFAULT_TITLE;
			else if (entry.key === "columns") config.columns = clampPositiveInteger(entry.value, DEFAULT_COLUMNS, "columns");
			continue;
		}

		if (trimmed.startsWith("- ")) {
			commitBlock();
			currentBlock = {};
			const remainder = trimmed.slice(2).trim();
			if (remainder) {
				const entry = parseKeyValue(remainder);
				if (!entry) throw new Error(`Invalid block entry: ${rawLine}`);
				applyBlockField(currentBlock, entry.key, entry.value);
			}
			continue;
		}

		const entry = parseKeyValue(trimmed);
		if (!entry || !currentBlock) {
			throw new Error(`Invalid YAML near line: ${rawLine}`);
		}
		applyBlockField(currentBlock, entry.key, entry.value);
	}

	commitBlock();
	return config;
}

function applyBlockField(block: Partial<DashboardBlock>, key: string, value: string): void {
	switch (key) {
		case "id":
			block.id = value;
			break;
		case "title":
			block.title = value;
			break;
		case "subtitle":
			block.subtitle = value;
			break;
		case "command":
			block.command = value;
			break;
		default:
			throw new Error(`Unsupported block field: ${key}`);
	}
}

function parseKeyValue(line: string): { key: string; value: string } | null {
	const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
	if (!match) return null;
	return { key: match[1], value: unquote(match[2] ?? "") };
}

function stripComment(line: string): string {
	let inSingle = false;
	let inDouble = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]!;
		if (ch === "'" && !inDouble) inSingle = !inSingle;
		else if (ch === '"' && !inSingle) inDouble = !inDouble;
		else if (ch === "#" && !inSingle && !inDouble) return line.slice(0, i);
	}
	return line;
}

function unquote(value: string): string {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function clampPositiveInteger(value: string, fallback: number, fieldName: string): number {
	const parsed = Number.parseInt(value, 10);
	if (Number.isFinite(parsed) && parsed > 0) return parsed;
	if (!value) return fallback;
	throw new Error(`${fieldName} must be a positive integer`);
}

function splitWidths(totalWidth: number, parts: number): number[] {
	if (parts <= 0) return [];
	const base = Math.floor(totalWidth / parts);
	const remainder = totalWidth % parts;
	return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

function padAnsi(text: string, width: number): string {
	const truncated = truncateToWidth(text, width, "", true);
	const padding = Math.max(0, width - visibleWidth(truncated));
	return truncated + " ".repeat(padding);
}

function buildSearchText(block: DashboardBlock, originalIndex: number): string {
	return [String(originalIndex + 1), block.id, block.title, block.subtitle, block.command].filter(Boolean).join(" ").toLowerCase();
}

function fuzzyScore(query: string, text: string): number | null {
	const tokens = query
		.toLowerCase()
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);

	if (tokens.length === 0) return 0;

	let total = 0;
	for (const token of tokens) {
		const tokenScore = fuzzyTokenScore(token, text);
		if (tokenScore === null) return null;
		total += tokenScore;
	}
	return total;
}

function fuzzyTokenScore(token: string, text: string): number | null {
	let lastIndex = -1;
	let score = 0;

	for (const char of token) {
		const foundIndex = text.indexOf(char, lastIndex + 1);
		if (foundIndex === -1) return null;

		const gap = foundIndex - lastIndex - 1;
		score += gap;

		if (foundIndex === 0 || /[^a-z0-9]/.test(text[foundIndex - 1] ?? "")) {
			score -= 2;
		}
		if (foundIndex === lastIndex + 1) {
			score -= 1;
		}

		lastIndex = foundIndex;
	}

	return score;
}
