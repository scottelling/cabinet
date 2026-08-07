import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/lib/storage/path-utils";
import {
  executeBrowserCommand,
  type BrowserCommand,
} from "./browser-service";

const ACCOUNT_ID = "account-for-browser-tests";
const API_TOKEN = "browser-token-for-tests";

async function withBrowserEnvironment(
  callback: (cwd: string) => Promise<void>,
): Promise<void> {
  const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  const previousToken = process.env.CLOUDFLARE_BROWSER_RUN_API_TOKEN;
  const cwd = path.join(DATA_DIR, `browser-service-${Date.now()}-${Math.random()}`);
  process.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;
  process.env.CLOUDFLARE_BROWSER_RUN_API_TOKEN = API_TOKEN;
  await fs.mkdir(cwd, { recursive: true });
  await fs.writeFile(path.join(cwd, ".cabinet"), "kind: room\nname: Browser Test\n");
  try {
    await callback(cwd);
  } finally {
    if (previousAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccount;
    if (previousToken === undefined) delete process.env.CLOUDFLARE_BROWSER_RUN_API_TOKEN;
    else process.env.CLOUDFLARE_BROWSER_RUN_API_TOKEN = previousToken;
    await fs.rm(cwd, { recursive: true, force: true });
  }
}

function command(overrides: Partial<BrowserCommand> = {}): BrowserCommand {
  return {
    action: "read",
    url: "https://example.com/research",
    engine: "auto",
    ...overrides,
  };
}

test("browser service reads a public page through Kitesurf and records evidence", async () => {
  await withBrowserEnvironment(async (cwd) => {
    const requests: Array<{ url: string; authorization: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("authorization") || "",
      });
      return new Response(
        JSON.stringify({ success: true, result: "# Example\n\nUseful research." }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-browser-ms-used": "321",
          },
        },
      );
    };

    const result = await executeBrowserCommand(
      command(),
      { cwd, runId: "browser-read-run" },
      { fetchImpl, now: () => new Date("2026-08-07T12:00:00.000Z") },
    );

    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/browser-run\/markdown\?browser=kitesurf$/);
    assert.equal(requests[0].authorization, `Bearer ${API_TOKEN}`);
    assert.match(result.content, /UNTRUSTED WEBSITE CONTENT/);
    assert.match(result.content, /Useful research/);
    assert.deepEqual(result.evidence, {
      id: "browser-read-run-1",
      action: "read",
      url: "https://example.com/research",
      requestedEngine: "auto",
      engine: "kitesurf",
      fallbackUsed: false,
      retrievedAt: "2026-08-07T12:00:00.000Z",
      browserMs: 321,
    });

    const audit = await fs.readFile(
      path.join(cwd, ".agents", ".browser", "audit.jsonl"),
      "utf8",
    );
    assert.match(audit, /"engine":"kitesurf"/);
    assert.doesNotMatch(audit, new RegExp(API_TOKEN));
  });
});

test("browser service falls back from Kitesurf to Chromium in auto mode", async () => {
  await withBrowserEnvironment(async (cwd) => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/browser-run/")) {
        return new Response(
          JSON.stringify({ success: false, errors: [{ message: "Unsupported page API" }] }),
          { status: 422, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, result: ["https://example.com/a"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await executeBrowserCommand(
      command({ action: "links" }),
      { cwd, runId: "browser-fallback-run" },
      { fetchImpl, now: () => new Date("2026-08-07T12:01:00.000Z") },
    );

    assert.equal(urls.length, 2);
    assert.match(urls[0], /\/browser-run\/links\?browser=kitesurf$/);
    assert.match(urls[1], /\/browser-rendering\/links$/);
    assert.equal(result.evidence.engine, "chromium");
    assert.equal(result.evidence.fallbackUsed, true);
    assert.match(result.content, /https:\/\/example\.com\/a/);
  });
});

test("browser service saves screenshots inside the active Cabinet", async () => {
  await withBrowserEnvironment(async (cwd) => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchImpl: typeof fetch = async () =>
      new Response(png, {
        status: 200,
        headers: { "content-type": "image/png", "x-browser-ms-used": "42" },
      });

    const result = await executeBrowserCommand(
      command({ action: "screenshot" }),
      { cwd, runId: "browser-shot-run" },
      { fetchImpl, now: () => new Date("2026-08-07T12:02:00.000Z") },
    );

    assert.ok(result.evidence.artifactPath);
    assert.match(result.evidence.artifactPath, /Browser Research\/example-com-2026-08-07T12-02-00-000Z\.png$/);
    assert.deepEqual(
      await fs.readFile(path.join(DATA_DIR, result.evidence.artifactPath!)),
      png,
    );
    assert.deepEqual(result.artifactPaths, [result.evidence.artifactPath]);
  });
});

test("browser service refuses private and credential-bearing URLs before calling Cloudflare", async () => {
  await withBrowserEnvironment(async (cwd) => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("unexpected");
    };

    await assert.rejects(
      executeBrowserCommand(
        command({ url: "http://127.0.0.1/private" }),
        { cwd, runId: "browser-private-run" },
        { fetchImpl },
      ),
      /public http/i,
    );
    await assert.rejects(
      executeBrowserCommand(
        command({ url: "https://user:password@example.com/" }),
        { cwd, runId: "browser-creds-run" },
        { fetchImpl },
      ),
      /credentials/i,
    );
    await assert.rejects(
      executeBrowserCommand(
        command({ url: "https://example.com/report?access_token=secret" }),
        { cwd, runId: "browser-query-creds-run" },
        { fetchImpl },
      ),
      /credential-like query/i,
    );
    assert.equal(calls, 0);
  });
});
