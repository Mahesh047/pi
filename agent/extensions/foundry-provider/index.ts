import Anthropic from "@anthropic-ai/sdk";
import {
  type Api,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  streamAnthropic,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type AnthropicModel = Model<"anthropic-messages">;

function getFoundryBaseUrl(): string {
  const explicit = process.env.AZURE_FOUNDRY_BASE_URL?.trim();
  if (explicit) {
    return explicit.endsWith("/") ? explicit : `${explicit}/`;
  }

  const resource = (process.env.ANTHROPIC_FOUNDRY_RESOURCE || "AIFoundryEmbedded").trim();
  return `https://${resource}.services.ai.azure.com/anthropic/`;
}

function mapThinkingLevelToEffort(level: SimpleStreamOptions["reasoning"]): "low" | "medium" | "high" | "xhigh" | "max" {
  switch (level) {
    case "minimal":
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "xhigh":
      return "xhigh";
    default:
      return "high";
  }
}

function createFoundryClient(baseURL: string, apiKey: string, extraHeaders?: Record<string, string>) {
  return new Anthropic({
    apiKey,
    authToken: null as any,
    baseURL,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      accept: "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
      ...(extraHeaders ?? {}),
      "api-key": null as any,
      Authorization: null as any,
    } as any,
  });
}

function streamFoundry(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  let anthropicModel = model as AnthropicModel;
  // Alias: route the 1M variant to the same underlying deployment
  if (anthropicModel.id === "claude-sonnet-4-6[1m]") {
    anthropicModel = { ...anthropicModel, id: "claude-sonnet-4-6" };
  }
  if (anthropicModel.id === "claude-opus-4-8[1m]") {
    anthropicModel = { ...anthropicModel, id: "claude-opus-4-8" };
  }
  if (anthropicModel.id === "claude-opus-5-5[1m]") {
    anthropicModel = { ...anthropicModel, id: "claude-opus-5-5" };
  }
  const apiKey = options?.apiKey || process.env.ANTHROPIC_FOUNDRY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_FOUNDRY_API_KEY for Foundry provider");
  }

  const client = createFoundryClient(anthropicModel.baseUrl, apiKey, options?.headers);

  const streamOptions: any = {
    client,
    apiKey,
    signal: options?.signal,
    maxTokens: options?.maxTokens,
    timeoutMs: options?.timeoutMs,
    maxRetries: options?.maxRetries,
    onPayload: options?.onPayload,
    onResponse: options?.onResponse,
    cacheRetention: options?.cacheRetention,
    sessionId: options?.sessionId,
    temperature: options?.temperature,
    metadata: options?.metadata,
    toolChoice: options?.toolChoice,
  };

  if (!options?.reasoning) {
    streamOptions.thinkingEnabled = false;
  } else {
    streamOptions.thinkingEnabled = true;
    streamOptions.effort = mapThinkingLevelToEffort(options.reasoning);
  }

  return streamAnthropic(anthropicModel, context, streamOptions);
}

export default function (pi: ExtensionAPI) {
  const baseUrl = getFoundryBaseUrl();

  pi.registerProvider("foundry", {
    name: "Microsoft Foundry",
    baseUrl,
    apiKey: "$ANTHROPIC_FOUNDRY_API_KEY",
    api: "anthropic-messages",
    models: [
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6 (Foundry)",
        reasoning: true,
        thinkingLevelMap: {
          xhigh: "xhigh",
        },
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 32000,
        compat: {
          forceAdaptiveThinking: true,
          supportsEagerToolInputStreaming: false,
        },
      },
      {
        id: "claude-sonnet-4-6[1m]",
        name: "Claude Sonnet 4.6 1M (Foundry)",
        reasoning: true,
        thinkingLevelMap: {
          xhigh: "xhigh",
        },
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 32000,
        compat: {
          forceAdaptiveThinking: true,
          supportsEagerToolInputStreaming: false,
        },
      },
      {
        id: "claude-opus-4-8",
        name: "Claude Opus 4.8 (Foundry)",
        reasoning: true,
        thinkingLevelMap: {
          xhigh: "xhigh",
        },
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 32000,
        compat: {
          forceAdaptiveThinking: true,
          supportsEagerToolInputStreaming: false,
        },
      },
      {
        id: "claude-opus-4-8[1m]",
        name: "Claude Opus 4.8 1M (Foundry)",
        reasoning: true,
        thinkingLevelMap: {
          xhigh: "xhigh",
        },
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 32000,
        compat: {
          forceAdaptiveThinking: true,
          supportsEagerToolInputStreaming: false,
        },
      },
      {
        id: "claude-opus-5-5",
        name: "Claude Opus 5.5 (Foundry)",
        reasoning: true,
        thinkingLevelMap: {
          xhigh: "xhigh",
        },
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 32000,
        compat: {
          forceAdaptiveThinking: true,
          supportsEagerToolInputStreaming: false,
        },
      },
      {
        id: "claude-opus-5-5[1m]",
        name: "Claude Opus 5.5 1M (Foundry)",
        reasoning: true,
        thinkingLevelMap: {
          xhigh: "xhigh",
        },
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 32000,
        compat: {
          forceAdaptiveThinking: true,
          supportsEagerToolInputStreaming: false,
        },
      },
    ],
    streamSimple: streamFoundry,
  });
}
