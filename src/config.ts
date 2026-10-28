import { GoogleGenAI } from "@google/genai";

export interface Config {
  model: string;
  timeoutMs: number;
  client: GoogleGenAI;
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 60_000;

let cached: Config | undefined;

/**
 * Reads configuration from environment variables. Called lazily on first tool use so
 * that a missing key is reported to the client as a tool error instead of crashing
 * the server process at startup.
 */
export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = parseTimeout(env.GEMINI_TIMEOUT_MS);

  let client: GoogleGenAI;
  if (env.GEMINI_PROVIDER === "vertex") {
    const project = env.VERTEX_PROJECT_ID;
    if (!project) {
      throw new Error(
        "VERTEX_PROJECT_ID is required when GEMINI_PROVIDER=vertex",
      );
    }
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: env.VERTEX_LOCATION || "us-central1",
    });
  } else {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is required (or set GEMINI_PROVIDER=vertex with VERTEX_PROJECT_ID)",
      );
    }
    client = new GoogleGenAI({ apiKey });
  }

  cached = { model, timeoutMs, client };
  return cached;
}

function parseTimeout(raw: string | undefined): number {
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`GEMINI_TIMEOUT_MS must be a positive number, got "${raw}"`);
  }
  return n;
}
