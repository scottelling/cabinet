import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/lib/storage/path-utils";
import { directApiAdapters } from "./direct-api";

test("direct API adapter executes file tools inside the active cabinet", async () => {
  const adapter = directApiAdapters.find((entry) => entry.providerId === "openai-api");
  assert.ok(adapter?.execute);

  const cwd = path.join(DATA_DIR, "direct-api-test-room");
  const target = path.join(cwd, "agent-proof.md");
  await fs.rm(cwd, { recursive: true, force: true });
  await fs.mkdir(cwd, { recursive: true });

  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-only";
  let requestCount = 0;
  let observedAuthorization = "";

  globalThis.fetch = (async (_input, init) => {
    requestCount += 1;
    observedAuthorization = new Headers(init?.headers).get("authorization") || "";
    if (requestCount === 1) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "write_file",
                      arguments: JSON.stringify({
                        path: "agent-proof.md",
                        content: "# Agent Proof\n\nCreated directly.\n",
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content:
                "Created the page.\n\n```cabinet\nSUMMARY: Created the proof page\nARTIFACT: agent-proof.md\n```",
            },
          },
        ],
        usage: { prompt_tokens: 30, completion_tokens: 15 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await adapter.execute({
      runId: "direct-api-test",
      adapterType: adapter.type,
      config: { model: "gpt-5.6-terra" },
      prompt: "Create the proof page.",
      cwd,
      onLog: async () => {},
    });

    assert.equal(result.exitCode, 0);
    assert.equal(requestCount, 2);
    assert.equal(observedAuthorization, "Bearer sk-test-only");
    assert.match(result.output || "", /ARTIFACT: agent-proof\.md/);
    assert.equal(
      await fs.readFile(target, "utf8"),
      "# Agent Proof\n\nCreated directly.\n"
    );
    await assert.rejects(fs.stat(path.join(DATA_DIR, "agent-proof.md")));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

