import type { Config } from "./config.js";
import { buildCitedText, extractSources, formatSources } from "./citations.js";
import { resolveSources } from "./resolve.js";

export async function googleSearch(
  config: Config,
  query: string,
  signal?: AbortSignal,
): Promise<string> {
  const signals = [AbortSignal.timeout(config.timeoutMs)];
  if (signal) signals.push(signal);

  const geminiStarted = Date.now();
  const response = await config.client.models.generateContent({
    model: config.model,
    contents: [{ role: "user", parts: [{ text: query }] }],
    config: {
      tools: [{ googleSearch: {} }],
      abortSignal: AbortSignal.any(signals),
    },
  });
  const geminiMs = Date.now() - geminiStarted;

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const metadata = candidate?.groundingMetadata;

  const text = buildCitedText(parts, metadata?.groundingSupports);
  if (!text.trim()) {
    const reason = candidate?.finishReason ?? response.promptFeedback?.blockReason;
    throw new Error(
      `Gemini returned an empty response${reason ? ` (reason: ${reason})` : ""}`,
    );
  }

  let sources = extractSources(metadata?.groundingChunks);
  let resolveInfo = "resolve skipped";
  if (config.resolveSourceUrls && sources.length > 0) {
    const started = Date.now();
    sources = await resolveSources(sources, signal);
    resolveInfo = `resolve ${Date.now() - started}ms`;
  }
  console.error(`gemini ${geminiMs}ms, ${resolveInfo} (${sources.length} sources)`);

  return text + formatSources(sources);
}
