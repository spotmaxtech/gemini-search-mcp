import type { GroundingChunk, GroundingSupport, Part } from "@google/genai";

export interface Source {
  index: number;
  title: string;
  uri: string;
}

/**
 * Concatenates the text parts of a response and inserts citation markers like "[1,2]".
 *
 * Gemini reports `segment.endIndex` in UTF-8 bytes relative to the part identified by
 * `segment.partIndex`, so insertions are done on the encoded bytes rather than on the
 * JS (UTF-16) string; otherwise markers drift in non-ASCII text such as Chinese.
 */
export function buildCitedText(
  parts: Part[],
  supports: GroundingSupport[] = [],
): string {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const partByteOffset = new Map<number, number>();
  let offset = 0;

  parts.forEach((part, i) => {
    if (typeof part.text !== "string" || part.thought) return;
    const bytes = encoder.encode(part.text);
    partByteOffset.set(i, offset);
    chunks.push(bytes);
    offset += bytes.length;
  });

  const bytes = concat(chunks);

  const insertions: Array<{ at: number; marker: Uint8Array }> = [];
  for (const support of supports) {
    const end = support.segment?.endIndex;
    const indices = support.groundingChunkIndices;
    if (end === undefined || !indices?.length) continue;

    const base = partByteOffset.get(support.segment?.partIndex ?? 0);
    if (base === undefined) continue;

    const at = Math.min(base + end, bytes.length);
    const numbers = [...new Set(indices)].map((n) => n + 1).sort((a, b) => a - b);
    insertions.push({ at, marker: encoder.encode(`[${numbers.join(",")}]`) });
  }

  // Stable sort by position so markers at the same offset keep their original order.
  insertions.sort((a, b) => a.at - b.at);

  const out: Uint8Array[] = [];
  let cursor = 0;
  for (const { at, marker } of insertions) {
    out.push(bytes.subarray(cursor, at), marker);
    cursor = at;
  }
  out.push(bytes.subarray(cursor));

  return new TextDecoder().decode(concat(out));
}

export function extractSources(chunks: GroundingChunk[] = []): Source[] {
  const sources: Source[] = [];
  chunks.forEach((chunk, i) => {
    const uri = chunk.web?.uri;
    if (!uri) return;
    sources.push({ index: i + 1, title: chunk.web?.title || uri, uri });
  });
  return sources;
}

export function formatSources(sources: Source[]): string {
  if (sources.length === 0) return "";
  return (
    "\n\nSources:\n" +
    sources.map((s) => `[${s.index}] ${s.title} (${s.uri})`).join("\n")
  );
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) {
    result.set(a, pos);
    pos += a.length;
  }
  return result;
}
