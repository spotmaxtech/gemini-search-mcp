import type { Source } from "./citations.js";

const REDIRECT_HOST = "vertexaisearch.cloud.google.com";
const RESOLVE_TIMEOUT_MS = 3_000;

/**
 * Grounding sources point at short-lived Google redirect links. Replace them with the
 * real page URLs by reading the redirect's Location header (the target page is never
 * downloaded). Lookups run in parallel; any failure keeps the original link.
 */
export async function resolveSources(
  sources: Source[],
  signal?: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<Source[]> {
  return Promise.all(
    sources.map(async (source) => ({
      ...source,
      uri: await resolveUrl(source.uri, signal, fetchFn),
    })),
  );
}

async function resolveUrl(
  uri: string,
  signal: AbortSignal | undefined,
  fetchFn: typeof fetch,
): Promise<string> {
  if (!isRedirectLink(uri)) return uri;

  const signals = [AbortSignal.timeout(RESOLVE_TIMEOUT_MS)];
  if (signal) signals.push(signal);

  try {
    const res = await fetchFn(uri, {
      redirect: "manual",
      signal: AbortSignal.any(signals),
    });
    await res.body?.cancel();
    const location = res.headers.get("location");
    return location ? new URL(location, uri).toString() : uri;
  } catch {
    return uri;
  }
}

function isRedirectLink(uri: string): boolean {
  try {
    return new URL(uri).hostname === REDIRECT_HOST;
  } catch {
    return false;
  }
}
