import type { Config } from "./config.js";
import { buildCitedText, extractSources, formatSources } from "./citations.js";

export async function googleSearch(
  config: Config,
  query: string,
  signal?: AbortSignal,
): Promise<string> {
  const signals = [AbortSignal.timeout(config.timeoutMs)];
  if (signal) signals.push(signal);

  const response = await config.client.models.generateContent({
    model: config.model,
    contents: [{ role: "user", parts: [{ text: query }] }],
    config: {
      tools: [{ googleSearch: {} }],
      abortSignal: AbortSignal.any(signals),
    },
  });

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

  return text + formatSources(extractSources(metadata?.groundingChunks));
}
