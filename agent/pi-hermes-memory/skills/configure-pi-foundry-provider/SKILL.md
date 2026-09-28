---
name: "configure-pi-foundry-provider"
description: "Add Microsoft Foundry Claude as a pi model via a global extension."
version: 2
created: "2026-06-09"
updated: "2026-06-30"
---
## When to Use
Use when pi should expose a Claude model hosted behind Microsoft/Azure Foundry and plain models.json is not sufficient or needs environment-derived base URL handling.

## Procedure
1. Create a global extension directory under ~/.pi/agent/extensions/foundry-provider with a package.json and index.ts entrypoint.
2. In the extension, compute the base URL from AZURE_FOUNDRY_BASE_URL when present, otherwise from ANTHROPIC_FOUNDRY_RESOURCE as https://<resource>.services.ai.azure.com/anthropic/ and ensure the URL ends with a trailing slash.
3. Register a provider named `foundry` with models `claude-sonnet-4-6`, `claude-sonnet-4-6[1m]`, `claude-opus-4-8`, and `claude-opus-4-8[1m]`, api `anthropic-messages`, and compat.forceAdaptiveThinking=true.
4. In streamFoundry, alias `[1m]`-suffixed model IDs to their base deployment IDs (e.g. `claude-sonnet-4-6[1m]` → `claude-sonnet-4-6`, `claude-opus-4-8[1m]` → `claude-opus-4-8`).
5. Use an Anthropic SDK client with the Foundry base URL and standard x-api-key auth via the normal apiKey field; do not force the Azure `api-key` header unless current evidence proves it is required.
6. Keep ~/.pi/agent/models.json empty or remove overlapping custom Foundry provider definitions to avoid confusion.
7. Verify with `pi --list-models foundry` and then `pi --model foundry/claude-opus-4-8 --no-tools -p "Reply with just ok"`.
## Pitfalls
- A base URL without the trailing slash after /anthropic can resolve requests incorrectly in SDK URL joining and make the provider fail.
- Do not assume Azure Foundry always needs an `api-key` header; on this machine standard Anthropic x-api-key auth succeeded while `api-key` returned 401.
- If pi sees the model but requests fail, isolate testing with `pi --no-extensions -e <extension-dir>` to rule out unrelated extensions.

## Verification
1. `pi --list-models foundry` shows `claude-sonnet-4-6`.
2. `pi --model foundry/claude-sonnet-4-6 --no-tools -p "Reply with just ok"` returns `ok`.