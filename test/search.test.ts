import { describe, expect, it } from "vitest";
import type { GoogleGenAI } from "@google/genai";
import type { Config } from "../src/config.js";
import { googleSearch } from "../src/search.js";

function fakeConfig(response: unknown, captured: { req?: any } = {}): Config {
  const client = {
    models: {
      generateContent: async (req: unknown) => {
        captured.req = req;
        return response;
      },
    },
  } as unknown as GoogleGenAI;
  return { model: "test-model", timeoutMs: 1000, resolveSourceUrls: true, client };
}

describe("googleSearch", () => {
  it("builds cited text with sources and enables the googleSearch tool", async () => {
    const captured: { req?: any } = {};
    const text = "东京是日本首都。";
    const config = fakeConfig(
      {
        candidates: [
          {
            content: { parts: [{ text }] },
            groundingMetadata: {
              groundingChunks: [{ web: { uri: "https://x.jp", title: "X" } }],
              groundingSupports: [
                {
                  segment: { endIndex: new TextEncoder().encode(text).length },
                  groundingChunkIndices: [0],
                },
              ],
            },
          },
        ],
      },
      captured,
    );

    const out = await googleSearch(config, "日本首都");
    expect(out).toBe("东京是日本首都。[1]\n\nSources:\n[1] X (https://x.jp)");
    expect(captured.req.model).toBe("test-model");
    expect(captured.req.config.tools).toEqual([{ googleSearch: {} }]);
    expect(captured.req.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("reports finish reason on empty response", async () => {
    const config = fakeConfig({
      candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }],
    });
    await expect(googleSearch(config, "q")).rejects.toThrow("reason: SAFETY");
  });
});
