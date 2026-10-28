import { describe, expect, it } from "vitest";
import { resolveSources } from "../src/resolve.js";

const REDIRECT = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/";

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

const redirectTo = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

describe("resolveSources", () => {
  it("replaces redirect links with the Location header without following it", async () => {
    const { fn, calls } = fakeFetch((url) =>
      url.endsWith("a") ? redirectTo("https://docs.a.com/page") : redirectTo("https://b.com/x"),
    );
    const out = await resolveSources(
      [
        { index: 1, title: "a.com", uri: REDIRECT + "a" },
        { index: 2, title: "b.com", uri: REDIRECT + "b" },
      ],
      undefined,
      fn,
    );
    expect(out.map((s) => s.uri)).toEqual(["https://docs.a.com/page", "https://b.com/x"]);
    expect(calls.every((c) => c.init?.redirect === "manual")).toBe(true);
  });

  it("does not fetch non-redirect links", async () => {
    const { fn, calls } = fakeFetch(() => redirectTo("https://never"));
    const out = await resolveSources([{ index: 1, title: "x", uri: "https://x.com" }], undefined, fn);
    expect(out[0].uri).toBe("https://x.com");
    expect(calls).toHaveLength(0);
  });

  it("keeps the original link on error or missing Location", async () => {
    const { fn } = fakeFetch((url) => {
      if (url.endsWith("err")) throw new Error("network down");
      return new Response("ok", { status: 200 });
    });
    const sources = [
      { index: 1, title: "e", uri: REDIRECT + "err" },
      { index: 2, title: "n", uri: REDIRECT + "none" },
    ];
    const out = await resolveSources(sources, undefined, fn);
    expect(out.map((s) => s.uri)).toEqual(sources.map((s) => s.uri));
  });

  it("gives up when the caller aborts", async () => {
    const controller = new AbortController();
    const { fn } = fakeFetch(
      (_url, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        ),
    );
    const pending = resolveSources([{ index: 1, title: "t", uri: REDIRECT + "slow" }], controller.signal, fn);
    controller.abort();
    expect((await pending)[0].uri).toBe(REDIRECT + "slow");
  });
});
