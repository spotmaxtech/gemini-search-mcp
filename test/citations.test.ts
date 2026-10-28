import { describe, expect, it } from "vitest";
import { buildCitedText, extractSources, formatSources } from "../src/citations.js";

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("buildCitedText", () => {
  it("inserts markers at ASCII byte offsets", () => {
    const text = "Hello world. Second sentence.";
    const out = buildCitedText([{ text }], [
      { segment: { endIndex: 12 }, groundingChunkIndices: [0] },
      { segment: { endIndex: text.length }, groundingChunkIndices: [2, 1] },
    ]);
    expect(out).toBe("Hello world.[1] Second sentence.[2,3]");
  });

  it("uses UTF-8 byte offsets for multi-byte text", () => {
    const first = "今天天气很好。";
    const text = first + "明天下雨。";
    const out = buildCitedText([{ text }], [
      { segment: { endIndex: bytes(first) }, groundingChunkIndices: [0] },
      { segment: { endIndex: bytes(text) }, groundingChunkIndices: [1] },
    ]);
    expect(out).toBe("今天天气很好。[1]明天下雨。[2]");
  });

  it("handles emoji (surrogate pairs)", () => {
    const first = "Go 🚀 now.";
    const out = buildCitedText([{ text: first + " Next." }], [
      { segment: { endIndex: bytes(first) }, groundingChunkIndices: [0] },
    ]);
    expect(out).toBe("Go 🚀 now.[1] Next.");
  });

  it("offsets by partIndex and skips thought parts", () => {
    const out = buildCitedText(
      [{ text: "thinking...", thought: true }, { text: "甲。" }, { text: "乙。" }],
      [
        { segment: { partIndex: 1, endIndex: bytes("甲。") }, groundingChunkIndices: [0] },
        { segment: { partIndex: 2, endIndex: bytes("乙。") }, groundingChunkIndices: [1] },
      ],
    );
    expect(out).toBe("甲。[1]乙。[2]");
  });

  it("clamps out-of-range offsets and ignores incomplete supports", () => {
    const out = buildCitedText([{ text: "abc" }], [
      { segment: { endIndex: 999 }, groundingChunkIndices: [0] },
      { segment: { endIndex: 1 } },
      { groundingChunkIndices: [1] },
    ]);
    expect(out).toBe("abc[1]");
  });

  it("returns plain text without supports", () => {
    expect(buildCitedText([{ text: "a" }, { text: "b" }])).toBe("ab");
  });
});

describe("sources", () => {
  it("keeps chunk numbering and skips non-web chunks", () => {
    const sources = extractSources([
      { web: { uri: "https://a.com", title: "A" } },
      { retrievedContext: { uri: "x" } },
      { web: { uri: "https://c.com" } },
    ]);
    expect(sources).toEqual([
      { index: 1, title: "A", uri: "https://a.com" },
      { index: 3, title: "https://c.com", uri: "https://c.com" },
    ]);
    expect(formatSources(sources)).toBe(
      "\n\nSources:\n[1] A (https://a.com)\n[3] https://c.com (https://c.com)",
    );
    expect(formatSources([])).toBe("");
  });
});
