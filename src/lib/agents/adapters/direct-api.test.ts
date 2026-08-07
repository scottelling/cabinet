import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DATA_DIR } from "@/lib/storage/path-utils";
import { addKnowledgeSource } from "@/lib/knowledge-sources/store";
import {
  authorizeDirectApiWorkspacePath,
  directApiAdapters,
} from "./direct-api";
import { getCabinetToolInventory } from "@/lib/tools/tool-platform";

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
  let observedToolNames: string[] = [];

  globalThis.fetch = (async (_input, init) => {
    requestCount += 1;
    observedAuthorization = new Headers(init?.headers).get("authorization") || "";
    const requestBody = JSON.parse(String(init?.body || "{}")) as {
      tools?: Array<{ function?: { name?: string } }>;
    };
    observedToolNames = (requestBody.tools ?? []).flatMap((tool) =>
      tool.function?.name ? [tool.function.name] : [],
    );
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
    assert.ok(observedToolNames.includes("list_cabinet_tools"));
    assert.ok(observedToolNames.includes("use_cabinet_tool"));
    assert.ok(observedToolNames.includes("propose_cabinet_tool_change"));
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

test("direct API agents can propose a Cabinet Tool without installing it", async () => {
  const adapter = directApiAdapters.find((entry) => entry.providerId === "openai-api");
  assert.ok(adapter?.execute);

  const cabinetPath = "direct-api-tool-proposal-room";
  const cwd = path.join(DATA_DIR, cabinetPath);
  await fs.rm(cwd, { recursive: true, force: true });
  await fs.mkdir(cwd, { recursive: true });
  await fs.writeFile(path.join(cwd, ".cabinet"), "kind: room\nname: Proposal Room\n");

  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-only";
  let requestCount = 0;

  globalThis.fetch = (async () => {
    requestCount += 1;
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
                    id: "call_tool_proposal",
                    type: "function",
                    function: {
                      name: "propose_cabinet_tool",
                      arguments: JSON.stringify({
                        manifest: {
                          schemaVersion: 1,
                          id: "launch-planner",
                          version: "1.0.0",
                          name: "Launch Planner",
                          description: "Plan and track a product launch.",
                          icon: "workflow",
                          permissions: [
                            "knowledge:read",
                            "knowledge:write",
                            "agents:run",
                          ],
                          surfaces: {
                            home: {
                              title: "Launch Planner",
                              description: "Turn launch knowledge into coordinated work.",
                            },
                            workspace: {
                              title: "Launch Planner",
                              description: "Choose a launch workflow.",
                              starterPrompts: [
                                {
                                  id: "make-plan",
                                  label: "Make launch plan",
                                  prompt: "Create a launch plan from this room's knowledge.",
                                },
                              ],
                            },
                          },
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
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
              content: "Proposed Launch Planner for approval.",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await adapter.execute({
      runId: "direct-api-tool-proposal",
      adapterType: adapter.type,
      config: { model: "gpt-5.6-terra" },
      prompt: "Build me a launch planning tool.",
      cwd,
      onLog: async () => {},
    });

    assert.equal(result.exitCode, 0);
    const inventory = await getCabinetToolInventory(cabinetPath);
    assert.deepEqual(inventory.installed, []);
    assert.deepEqual(
      inventory.proposals.map((proposal) => proposal.manifest.id),
      ["launch-planner"]
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("direct API file tools reject unregistered symlinks outside the active room", async () => {
  const cabinetPath = "direct-api-symlink-guard-room";
  const cwd = path.join(DATA_DIR, cabinetPath);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "cabinet-outside-"));
  await fs.mkdir(cwd, { recursive: true });
  await fs.writeFile(path.join(cwd, ".cabinet"), "kind: room\nname: Guard Room\n");
  await fs.writeFile(path.join(outside, "secret.txt"), "outside secret\n");
  await fs.symlink(path.join(outside, "secret.txt"), path.join(cwd, "leak.txt"));

  try {
    await assert.rejects(
      authorizeDirectApiWorkspacePath("leak.txt", cwd, "read"),
      /outside this Cabinet/,
    );
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test("direct API file tools can read a connected source but cannot mutate a read-only source", async () => {
  const cabinetPath = "direct-api-read-only-source-room";
  const cwd = path.join(DATA_DIR, cabinetPath);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "cabinet-source-"));
  const mountPath = path.join(cwd, "reference");
  await fs.mkdir(cwd, { recursive: true });
  await fs.writeFile(path.join(cwd, ".cabinet"), "kind: room\nname: Source Room\n");
  await fs.writeFile(path.join(outside, "notes.md"), "# Reference\n");
  await fs.symlink(outside, mountPath);
  await addKnowledgeSource(cabinetPath, {
    provider: "local",
    absPath: outside,
    name: "Reference",
    policy: "read-only",
    surface: "inline",
    treePath: `${cabinetPath}/reference`,
  });

  try {
    assert.equal(
      await authorizeDirectApiWorkspacePath("reference/notes.md", cwd, "read"),
      path.join(cwd, "reference", "notes.md"),
    );
    await assert.rejects(
      authorizeDirectApiWorkspacePath("reference/notes.md", cwd, "write"),
      /connected read-only/,
    );
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});
