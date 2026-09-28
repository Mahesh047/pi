import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, Text, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

interface QuestionnaireQuestion {
  id: string;
  label: string;
  prompt: string;
  options: string[];
  multiSelect: boolean;
  allowCustom: boolean;
  placeholder?: string;
}

interface QuestionnaireAnswer {
  id: string;
  prompt: string;
  answer: string | string[];
  wasCustom: boolean;
  index?: number | number[];
}

interface QuestionnaireDetails {
  questions: QuestionnaireQuestion[];
  answers: QuestionnaireAnswer[];
  cancelled: boolean;
}

type RenderOption = {
  label: string;
  isOther?: boolean;
};

const AskUserQuestionSchema = Type.Object({
  id: Type.String({ description: "Unique identifier for this question" }),
  label: Type.Optional(Type.String({ description: "Short label shown in the questionnaire tab bar" })),
  question: Type.String({ description: "Question text to show the user" }),
  options: Type.Optional(
    Type.Array(Type.String({ description: "One selectable option" }), {
      description: "Optional list of choices for this question",
    }),
  ),
  multiSelect: Type.Optional(
    Type.Boolean({
      description: "Allow selecting multiple options (default: false)",
    }),
  ),
  allowCustom: Type.Optional(
    Type.Boolean({
      description: "When options are provided, also offer a custom free-text answer",
    }),
  ),
  placeholder: Type.Optional(Type.String({ description: "Optional placeholder or hint for custom text input" })),
});

const AskUserParams = Type.Object({
  question: Type.Optional(Type.String({ description: "Single question to ask the user" })),
  placeholder: Type.Optional(Type.String({ description: "Optional placeholder text" })),
  options: Type.Optional(
    Type.Array(Type.String({ description: "One selectable option" }), {
      description: "Optional list of choices to present to the user",
    }),
  ),
  multiSelect: Type.Optional(
    Type.Boolean({
      description: "Allow selecting one or more options for a single question",
    }),
  ),
  allowCustom: Type.Optional(
    Type.Boolean({
      description: "When options are provided, also offer a custom free-text answer",
    }),
  ),
  questions: Type.Optional(
    Type.Array(AskUserQuestionSchema, {
      description:
        "Ask multiple questions in one questionnaire UI and return all answers together in a single tool result",
    }),
  ),
});

function normalizeOptions(options?: string[]): string[] {
  return (options ?? []).map((option) => option.trim()).filter((option) => option.length > 0);
}

function summarizeQuestionnaire(details: QuestionnaireDetails): string {
  return details.answers
    .map((answer) => {
      const value = Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer;
      return `${answer.id}: ${value}`;
    })
    .join("\n");
}

async function runMultiSelectQuestion(
  ctx: any,
  prompt: string,
  options: string[],
  placeholder?: string,
  allowCustom = false,
): Promise<string[] | undefined> {
  return ctx.ui.custom<string[] | undefined>((tui, theme, _kb, done) => {
    let optionIndex = 0;
    let inputMode = false;
    let cachedLines: string[] | undefined;
    let customAnswer = "";
    const selected = new Set<number>();

    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);

    const otherIndex = allowCustom ? options.length : -1;
    const maxIndex = options.length + (allowCustom ? 1 : 0) - 1;

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function buildAnswer(): string[] {
      const values = Array.from(selected)
        .sort((a, b) => a - b)
        .map((index) => options[index]);
      if (customAnswer.trim()) values.push(customAnswer.trim());
      return values;
    }

    editor.onSubmit = (value) => {
      customAnswer = value.trim();
      inputMode = false;
      editor.setText(customAnswer);
      refresh();
    };

    function handleInput(data: string) {
      if (inputMode) {
        if (matchesKey(data, Key.escape)) {
          inputMode = false;
          editor.setText(customAnswer);
          refresh();
          return;
        }
        editor.handleInput(data);
        refresh();
        return;
      }

      if (matchesKey(data, Key.up)) {
        optionIndex = Math.max(0, optionIndex - 1);
        refresh();
        return;
      }

      if (matchesKey(data, Key.down)) {
        optionIndex = Math.min(maxIndex, optionIndex + 1);
        refresh();
        return;
      }

      if (matchesKey(data, Key.space)) {
        if (optionIndex < options.length) {
          if (selected.has(optionIndex)) selected.delete(optionIndex);
          else selected.add(optionIndex);
          refresh();
          return;
        }
      }

      if (matchesKey(data, Key.enter)) {
        if (allowCustom && optionIndex === otherIndex) {
          inputMode = true;
          editor.setText(customAnswer);
          refresh();
          return;
        }

        const answer = buildAnswer();
        if (answer.length > 0) {
          done(answer);
        }
        return;
      }

      if (matchesKey(data, Key.escape)) {
        done(undefined);
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const add = (text: string) => lines.push(truncateToWidth(text, width));

      add(theme.fg("accent", "─".repeat(width)));
      add(theme.fg("text", ` ${prompt}`));
      lines.push("");

      for (let index = 0; index < options.length; index++) {
        const active = optionIndex === index;
        const checkbox = selected.has(index) ? theme.fg("success", "[x]") : "[ ]";
        const prefix = active ? theme.fg("accent", "> ") : "  ";
        add(`${prefix}${checkbox} ${theme.fg(active ? "accent" : "text", `${index + 1}. ${options[index]}`)}`);
      }

      if (allowCustom) {
        const active = optionIndex === otherIndex;
        const checked = customAnswer.trim().length > 0;
        const checkbox = checked ? theme.fg("success", "[x]") : "[ ]";
        const prefix = active ? theme.fg("accent", "> ") : "  ";
        const label = checked ? `Other: ${customAnswer}` : "Other (type your own)";
        add(`${prefix}${checkbox} ${theme.fg(active ? "accent" : "text", label)}`);
      }

      lines.push("");
      const selectedSummary = buildAnswer();
      if (selectedSummary.length > 0) {
        add(theme.fg("success", ` Selected: ${selectedSummary.join(", ")}`));
      } else {
        add(theme.fg("dim", " Select one or more options, then press Enter to submit"));
      }

      if (inputMode) {
        lines.push("");
        if (placeholder) add(theme.fg("muted", ` Hint: ${placeholder}`));
        add(theme.fg("muted", " Your custom answer:"));
        for (const line of editor.render(width - 2)) add(` ${line}`);
        lines.push("");
        add(theme.fg("dim", " Enter to save • Esc to go back"));
      } else {
        lines.push("");
        add(
          theme.fg(
            "dim",
            allowCustom
              ? " ↑↓ navigate • Space toggle • Enter submit • Enter on Other to edit • Esc cancel"
              : " ↑↓ navigate • Space toggle • Enter submit • Esc cancel",
          ),
        );
      }

      add(theme.fg("accent", "─".repeat(width)));
      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}

async function runQuestionnaire(
  ctx: any,
  questions: QuestionnaireQuestion[],
): Promise<QuestionnaireDetails> {
  return ctx.ui.custom<QuestionnaireDetails>((tui, theme, _kb, done) => {
    const isMulti = questions.length > 1;
    const totalTabs = questions.length + (isMulti ? 1 : 0);
    let currentTab = 0;
    let optionIndex = 0;
    let inputMode = false;
    let inputQuestionId: string | null = null;
    let cachedLines: string[] | undefined;
    const answers = new Map<string, QuestionnaireAnswer>();
    const multiSelections = new Map<string, Set<number>>(); // for multi-select questions


    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function currentQuestion(): QuestionnaireQuestion | undefined {
      return questions[currentTab];
    }

    function currentOptions(): RenderOption[] {
      const question = currentQuestion();
      if (!question) return [];

      const options: RenderOption[] = question.options.map((label) => ({ label }));

      if (question.options.length === 0 || question.allowCustom) {
        options.push({
          label: question.options.length === 0 ? "Type your answer" : "Other (type your own)",
          isOther: true,
        });
      }

      return options;
    }

    function allAnswered(): boolean {
      return questions.every((question) => {
        if (answers.has(question.id)) return true;
        if (question.multiSelect) {
          const selectedSet = multiSelections.get(question.id);
          return selectedSet && selectedSet.size > 0;
        }
        return false;
      });
    }

    function submit(cancelled: boolean) {
      if (!cancelled) {
        for (const question of questions) {
          if (question.multiSelect && !answers.has(question.id)) {
            const selectedSet = multiSelections.get(question.id) || new Set<number>();
            if (selectedSet.size > 0) {
              const selectedLabels = Array.from(selectedSet).map((index) => question.options[index]);
              const selectedIndices = Array.from(selectedSet).map((index) => index + 1);
              saveAnswer(question, selectedLabels, false, selectedIndices);
            }
          }
        }
      }
      done({ questions, answers: Array.from(answers.values()), cancelled });
    }

    function saveAnswer(question: QuestionnaireQuestion, answer: string | string[], wasCustom: boolean, index?: number | number[]) {
      answers.set(question.id, {
        id: question.id,
        prompt: question.prompt,
        answer,
        wasCustom,
        index,
      });
    }

    function advanceAfterAnswer() {
      if (!isMulti) {
        submit(false);
        return;
      }

      // Save current question's answer if not already saved
      const question = currentQuestion();
      if (question && !answers.has(question.id)) {
        if (question.multiSelect) {
          const selectedSet = multiSelections.get(question.id) || new Set();
          const selectedLabels = Array.from(selectedSet).map(i => question.options[i]);
          const selectedIndices = Array.from(selectedSet).map(i => i + 1);
          saveAnswer(question, selectedLabels, false, selectedIndices);
        } else {
          // Should already be saved for single-select
        }
      }

      if (currentTab < questions.length - 1) {
        currentTab += 1;
      } else {
        currentTab = questions.length;
      }
      optionIndex = 0;
      refresh();
    }

    editor.onSubmit = (value) => {
      if (!inputQuestionId) return;
      const question = questions.find((item) => item.id === inputQuestionId);
      if (!question) return;

      const answer = value.trim() || "(empty)";
      saveAnswer(question, answer, true);
      inputMode = false;
      inputQuestionId = null;
      editor.setText("");
      advanceAfterAnswer();
    };

    function handleInput(data: string) {
      if (inputMode) {
        if (matchesKey(data, Key.escape)) {
          inputMode = false;
          inputQuestionId = null;
          editor.setText("");
          refresh();
          return;
        }

        editor.handleInput(data);
        refresh();
        return;
      }

      if (isMulti) {
        if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
          currentTab = (currentTab + 1) % totalTabs;
          optionIndex = 0;
          refresh();
          return;
        }

        if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
          currentTab = (currentTab - 1 + totalTabs) % totalTabs;
          optionIndex = 0;
          refresh();
          return;
        }
      }

      if (isMulti && currentTab === questions.length) {
        if (matchesKey(data, Key.enter) && allAnswered()) {
          submit(false);
          return;
        }
        if (matchesKey(data, Key.escape)) {
          submit(true);
          return;
        }
        return;
      }

      const question = currentQuestion();
      const options = currentOptions();

      if (matchesKey(data, Key.up)) {
        optionIndex = Math.max(0, optionIndex - 1);
        refresh();
        return;
      }

      if (matchesKey(data, Key.down)) {
        optionIndex = Math.min(options.length - 1, optionIndex + 1);
        refresh();
        return;
      }

      if (matchesKey(data, Key.space) && question && question.multiSelect) {
        const selected = options[optionIndex];
        if (!selected || selected.isOther) return;

        const selectedSet = multiSelections.get(question.id) || new Set<number>();
        if (selectedSet.has(optionIndex)) {
          selectedSet.delete(optionIndex);
        } else {
          selectedSet.add(optionIndex);
        }
        multiSelections.set(question.id, selectedSet);
        refresh();
        return;
      }

      if (matchesKey(data, Key.enter) && question) {
        const selected = options[optionIndex];
        if (!selected) return;

        if (selected.isOther) {
          inputMode = true;
          inputQuestionId = question.id;
          editor.setText("");
          refresh();
          return;
        }

        if (question.multiSelect) {
          if (!isMulti) {
            const selectedSet = multiSelections.get(question.id) || new Set<number>();
            if (selectedSet.size > 0) {
              const selectedLabels = Array.from(selectedSet).map((index) => question.options[index]);
              const selectedIndices = Array.from(selectedSet).map((index) => index + 1);
              saveAnswer(question, selectedLabels, false, selectedIndices);
              submit(false);
            }
          }
          return;
        } else {
          saveAnswer(question, selected.label, false, optionIndex + 1);
          advanceAfterAnswer();
          return;
        }
      }

      if (matchesKey(data, Key.escape)) {
        submit(true);
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const add = (text: string) => lines.push(truncateToWidth(text, width));
      const question = currentQuestion();
      const options = currentOptions();

      add(theme.fg("accent", "─".repeat(width)));

      if (isMulti) {
        const tabs: string[] = ["← "];
        for (let index = 0; index < questions.length; index++) {
          const item = questions[index];
          const active = index === currentTab;
          const answered = answers.has(item.id);
          const box = answered ? "■" : "□";
          const label = ` ${box} ${item.label} `;
          const styled = active
            ? theme.bg("selectedBg", theme.fg("text", label))
            : theme.fg(answered ? "success" : "muted", label);
          tabs.push(`${styled} `);
        }

        const onSubmitTab = currentTab === questions.length;
        const submitLabel = " ✓ Submit ";
        const submitStyled = onSubmitTab
          ? theme.bg("selectedBg", theme.fg("text", submitLabel))
          : theme.fg(allAnswered() ? "success" : "dim", submitLabel);
        tabs.push(`${submitStyled} →`);
        add(` ${tabs.join("")}`);
        lines.push("");
      }

      const renderOptions = () => {
        for (let index = 0; index < options.length; index++) {
          const option = options[index];
          const selected = index === optionIndex;
          const multi = question?.multiSelect;
          let prefix = selected ? theme.fg("accent", "> ") : "  ";
          if (multi && !option.isOther) {
            const selectedSet = multiSelections.get(question.id) || new Set();
            const checked = selectedSet.has(index);
            prefix = selected ? theme.fg("accent", "> ") : "  ";
            const checkbox = checked ? theme.fg("success", "[x] ") : "[ ] ";
            prefix += checkbox;
          } else {
            prefix += "   "; // align
          }
          const text = `${index + 1}. ${option.label}`;
          add(prefix + theme.fg(selected ? "accent" : "text", text));
        }
      };

      if (isMulti && currentTab === questions.length) {
        add(theme.fg("accent", theme.bold(" Ready to submit")));
        lines.push("");

        for (const item of questions) {
          const answer = answers.get(item.id);
          let value: string;
          if (answer) {
            if (Array.isArray(answer.answer)) {
              value = answer.answer.join(", ");
            } else {
              value = answer.answer;
            }
            if (answer.wasCustom) {
              value = theme.fg("muted", "(wrote) ") + value;
            }
          } else if (item.multiSelect) {
            const selectedSet = multiSelections.get(item.id) || new Set<number>();
            value = selectedSet.size > 0
              ? Array.from(selectedSet).map((index) => item.options[index]).join(", ")
              : theme.fg("warning", "(unanswered)");
          } else {
            value = theme.fg("warning", "(unanswered)");
          }
          add(`${theme.fg("muted", ` ${item.label}: `)}${value}`);
        }

        lines.push("");
        add(
          allAnswered()
            ? theme.fg("success", " Press Enter to send all answers to pi")
            : theme.fg("warning", " Answer every question before submitting"),
        );
      } else if (question) {
        add(theme.fg("text", ` ${question.prompt}`));
        lines.push("");
        renderOptions();

        if (inputMode) {
          lines.push("");
          if (question.placeholder) {
            add(theme.fg("muted", ` Hint: ${question.placeholder}`));
          }
          add(theme.fg("muted", " Your answer:"));
          for (const line of editor.render(width - 2)) {
            add(` ${line}`);
          }
          lines.push("");
          add(theme.fg("dim", " Enter to save this answer • Esc to go back"));
        }
      }

      lines.push("");
      if (!inputMode) {
        const multi = question?.multiSelect;
        const help = isMulti
          ? multi
            ? " Tab/←→ switch questions • ↑↓ select • Space toggle • Enter on submit tab • Esc cancel"
            : " Tab/←→ switch questions • ↑↓ select • Enter confirm • Esc cancel"
          : multi
          ? " ↑↓ select • Space toggle • Enter submit • Esc cancel"
          : " ↑↓ select • Enter select • Esc cancel";
        add(theme.fg("dim", help));
      }
      add(theme.fg("accent", "─".repeat(width)));

      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}

export default function askUserDemo(pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_user",
    label: "Ask User",
    description:
      "Ask the user a single question or a multi-question questionnaire. A single question can be free-text, single-select, or multi-select. When multiple clarifications are needed, prefer one call with questions[] so the user answers everything before the agent continues.",
    parameters: AskUserParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "Error: ask_user requires interactive mode." }],
          details: { question: params.question ?? null, answer: null },
        };
      }

      const questionnaireQuestions = (params.questions ?? []).map((question, index) => ({
        id: question.id,
        label: question.label?.trim() || `Q${index + 1}`,
        prompt: question.question,
        options: normalizeOptions(question.options),
        multiSelect: question.multiSelect === true,
        allowCustom: question.allowCustom !== false,
        placeholder: question.placeholder,
      }));

      if (questionnaireQuestions.length > 0) {
        const result = await runQuestionnaire(ctx, questionnaireQuestions);

        if (result.cancelled) {
          return {
            content: [{ type: "text", text: "User cancelled the questionnaire." }],
            details: result,
          };
        }

        return {
          content: [{ type: "text", text: summarizeQuestionnaire(result) }],
          details: result,
        };
      }

      if (!params.question) {
        return {
          content: [{ type: "text", text: "Error: provide question for a single prompt or questions[] for a questionnaire." }],
          details: { question: null, answer: null },
        };
      }

      const options = normalizeOptions(params.options);
      const allowCustom = params.allowCustom === true;
      const multiSelect = params.multiSelect === true;
      let answer: string | string[] | undefined;

      if (options.length > 0 && multiSelect) {
        answer = await runMultiSelectQuestion(
          ctx,
          params.question,
          options,
          params.placeholder,
          allowCustom,
        );
      } else if (options.length > 0) {
        const customLabel = "Other (type your own)";
        const selection = await ctx.ui.select(
          params.question,
          allowCustom ? [...options, customLabel] : options,
        );

        if (selection === undefined) {
          return {
            content: [{ type: "text", text: "User cancelled the question." }],
            details: { question: params.question, answer: null, options, multiSelect },
          };
        }

        if (allowCustom && selection === customLabel) {
          answer = await ctx.ui.input(params.question, params.placeholder ?? "Type your answer...");
        } else {
          answer = selection;
        }
      } else {
        answer = await ctx.ui.input(params.question, params.placeholder ?? "Type your answer...");
      }

      if (answer === undefined) {
        return {
          content: [{ type: "text", text: "User cancelled the question." }],
          details: { question: params.question, answer: null, options, multiSelect },
        };
      }

      const answerText = Array.isArray(answer) ? answer.join(", ") : answer;
      return {
        content: [{ type: "text", text: `answer: ${answerText}` }],
        details: { question: params.question, answer, options, multiSelect },
      };
    },

    renderCall(args, theme) {
      const questions = Array.isArray(args.questions) ? args.questions : [];
      if (questions.length > 0) {
        const labels = questions
          .map((question: { label?: string; id?: string }) => question.label || question.id || "question")
          .join(", ");
        return new Text(
          `${theme.fg("toolTitle", theme.bold("ask_user "))}${theme.fg("muted", `${questions.length} questions`)}${theme.fg("dim", ` (${truncateToWidth(labels, 40)})`)}`,
          0,
          0,
        );
      }

      const label = typeof args.question === "string" ? truncateToWidth(args.question, 48) : "question";
      return new Text(
        `${theme.fg("toolTitle", theme.bold("ask_user "))}${theme.fg("muted", label)}`,
        0,
        0,
      );
    },

    renderResult(result, _options, theme) {
      const details = result.details as QuestionnaireDetails | { answer?: string | string[] | null } | undefined;
      if (!details) {
        const first = result.content[0];
        return new Text(first?.type === "text" ? first.text : "", 0, 0);
      }

      if ("cancelled" in details) {
        if (details.cancelled) {
          return new Text(theme.fg("warning", "Cancelled"), 0, 0);
        }

        const lines = details.answers.map((answer) => {
          const prefix = answer.wasCustom ? theme.fg("muted", "(wrote) ") : "";
          const value = Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer;
          return `${theme.fg("success", "✓ ")}${theme.fg("accent", answer.id)}: ${prefix}${value}`;
        });
        return new Text(lines.join("\n"), 0, 0);
      }

      if (details.answer == null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      const answerText = Array.isArray(details.answer) ? details.answer.join(", ") : details.answer;
      return new Text(`${theme.fg("success", "✓ ")}${answerText}`, 0, 0);
    },
  });
}
