import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DATA_DIR } from "@/lib/storage/path-utils";
import {
  applyCabinetToolEvent,
  cabinetToolsDirectory,
  executeCabinetToolCommand,
  getCabinetToolCatalog,
  getCabinetToolInventory,
  getCabinetToolState,
  installCabinetTool,
  listCabinetToolEvents,
  proposeCabinetToolChange,
  proposeCabinetTool,
  listInstalledCabinetTools,
  rollbackCabinetTool,
  setCabinetToolEnabled,
  uninstallCabinetTool,
} from "@/lib/tools/tool-platform";
import type { CabinetToolManifest } from "@/types/tools";

const roomA = "tool-platform-room-a";
const roomB = "tool-platform-room-b";

async function createRoom(cabinetPath: string) {
  const directory = path.join(DATA_DIR, cabinetPath);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, ".cabinet"),
    "kind: room\nname: Tool Platform Test\n",
    "utf8",
  );
}

const customTool: CabinetToolManifest = {
  schemaVersion: 1,
  id: "customer-research",
  version: "1.0.0",
  name: "Customer Research",
  description:
    "Turn interviews and notes into an evidence-backed research brief.",
  icon: "search",
  permissions: ["knowledge:read", "knowledge:write", "agents:run"],
  surfaces: {
    home: {
      title: "Customer Research",
      description: "Build a research brief from this room's knowledge.",
    },
    workspace: {
      title: "Customer Research",
      description: "Choose a starting workflow or write a custom request.",
      starterPrompts: [
        {
          id: "synthesize-interviews",
          label: "Synthesize interviews",
          prompt:
            "Read the customer interviews in this room and create a research brief.",
        },
      ],
      blocks: [
        {
          id: "interview-form",
          type: "form",
          title: "Add interview",
          collectionId: "interviews",
          fields: ["customer", "status", "score"],
          actionLabel: "Save interview",
        },
        {
          id: "interview-table",
          type: "table",
          title: "Interviews",
          collectionId: "interviews",
          fields: ["customer", "status", "score"],
        },
      ],
    },
  },
  collections: [
    {
      id: "interviews",
      name: "Interviews",
      fields: [
        { id: "customer", label: "Customer", type: "text", required: true },
        {
          id: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "planned", label: "Planned" },
            { value: "complete", label: "Complete" },
          ],
        },
        { id: "score", label: "Score", type: "number" },
      ],
    },
  ],
  automations: [
    {
      id: "capture-completed-task",
      name: "Capture completed tasks",
      event: "task.completed",
      action: {
        type: "add-record",
        collectionId: "interviews",
        values: {
          customer: "Completed task",
          status: "complete",
          score: 1,
        },
      },
    },
  ],
};

test.before(async () => {
  await Promise.all([createRoom(roomA), createRoom(roomB)]);
});

test.after(async () => {
  await Promise.all([
    fs.rm(path.join(DATA_DIR, roomA), { recursive: true, force: true }),
    fs.rm(path.join(DATA_DIR, roomB), { recursive: true, force: true }),
  ]);
});

test("the catalog exposes a validated built-in tool", () => {
  const catalog = getCabinetToolCatalog();
  const researchBrief = catalog.find((tool) => tool.id === "research-brief");

  assert.ok(researchBrief);
  assert.equal(researchBrief.schemaVersion, 1);
  assert.ok(researchBrief.surfaces.home);
  assert.ok(researchBrief.surfaces.workspace);
});

test("a declarative tool installs in one room without leaking into another", async () => {
  const installed = await installCabinetTool(roomA, customTool);

  assert.equal(installed.manifest.id, customTool.id);
  assert.equal(installed.source, "custom");
  assert.deepEqual(
    (await listInstalledCabinetTools(roomA)).map((entry) => entry.manifest.id),
    [customTool.id],
  );
  assert.deepEqual(await listInstalledCabinetTools(roomB), []);
});

test("installing a built-in tool is idempotent and preserves its original installation time", async () => {
  const first = await installCabinetTool(roomA, "research-brief");
  const second = await installCabinetTool(roomA, "research-brief");

  assert.equal(second.manifest.id, "research-brief");
  assert.equal(second.source, "built-in");
  assert.equal(second.installedAt, first.installedAt);
  assert.equal(
    (await listInstalledCabinetTools(roomA)).filter(
      (entry) => entry.manifest.id === "research-brief",
    ).length,
    1,
  );
});

test("removing a tool leaves the room and its other tools intact", async () => {
  await uninstallCabinetTool(roomA, customTool.id);

  assert.deepEqual(
    (await listInstalledCabinetTools(roomA)).map((entry) => entry.manifest.id),
    ["research-brief"],
  );
  assert.equal(
    await fs.readFile(path.join(DATA_DIR, roomA, ".cabinet"), "utf8"),
    "kind: room\nname: Tool Platform Test\n",
  );
  const trashRoot = path.join(DATA_DIR, roomA, ".cabinet-tool-trash");
  const backups = await fs.readdir(trashRoot);
  assert.ok(backups.some((entry) => entry.includes(customTool.id)));
  const backup = backups.find((entry) => entry.includes(customTool.id));
  assert.ok(backup);
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(trashRoot, backup, "installation.json"),
        "utf8",
      ),
    ).manifest.id,
    customTool.id,
  );
});

test("invalid permissions are rejected before anything is written", async () => {
  const invalid = {
    ...customTool,
    id: "unsafe-tool",
    permissions: ["host:everything"],
  } as unknown as CabinetToolManifest;

  await assert.rejects(
    installCabinetTool(roomB, invalid),
    /Unsupported Cabinet Tool permission/,
  );
  assert.deepEqual(await listInstalledCabinetTools(roomB), []);
});

test("an agent proposal stays uninstalled until a human approves it", async () => {
  const proposal = await proposeCabinetTool(roomB, customTool);

  assert.equal(proposal.manifest.id, customTool.id);
  assert.deepEqual(await listInstalledCabinetTools(roomB), []);
  const inventory = await getCabinetToolInventory(roomB);
  assert.deepEqual(
    inventory.proposals.map((entry) => entry.manifest.id),
    [customTool.id],
  );

  await installCabinetTool(roomB, proposal.manifest);
  const approved = await getCabinetToolInventory(roomB);
  assert.deepEqual(
    approved.installed.map((entry) => entry.manifest.id),
    [customTool.id],
  );
  assert.deepEqual(approved.proposals, []);
});

test("an installed tool owns versioned records that agents can use during chat", async () => {
  await installCabinetTool(roomA, customTool);

  const before = await getCabinetToolState(roomA, customTool.id);
  assert.equal(before.revision, 0);
  assert.deepEqual(before.collections.interviews, []);

  const result = await executeCabinetToolCommand(roomA, {
    type: "add-record",
    toolId: customTool.id,
    collectionId: "interviews",
    values: { customer: "Acme", status: "planned", score: 8 },
    actor: { type: "agent", id: "researcher" },
  });

  assert.equal(result.state.revision, 1);
  assert.equal(result.record?.values.customer, "Acme");
  assert.equal(result.record?.createdBy.type, "agent");
  assert.equal(
    (await getCabinetToolState(roomA, customTool.id)).collections.interviews[0]
      ?.values.score,
    8,
  );
});

test("tool updates wait for approval and can be rolled back", async () => {
  await installCabinetTool(roomA, customTool);
  const nextManifest: CabinetToolManifest = {
    ...customTool,
    version: "1.1.0",
    name: "Customer Insight Board",
  };

  const proposal = await proposeCabinetToolChange(
    roomA,
    customTool.id,
    nextManifest,
    "The conversation needs a clearer customer-facing name.",
  );
  assert.equal(proposal.kind, "update");
  assert.equal(proposal.baseVersion, "1.0.0");
  assert.equal(
    (await listInstalledCabinetTools(roomA)).find(
      (entry) => entry.manifest.id === customTool.id,
    )?.manifest.name,
    "Customer Research",
  );

  await installCabinetTool(roomA, proposal.manifest);
  assert.equal(
    (await listInstalledCabinetTools(roomA)).find(
      (entry) => entry.manifest.id === customTool.id,
    )?.manifest.name,
    "Customer Insight Board",
  );

  const rolledBack = await rollbackCabinetTool(
    roomA,
    customTool.id,
    "1.0.0",
  );
  assert.equal(rolledBack.manifest.name, "Customer Research");
  assert.equal(rolledBack.manifest.version, "1.0.0");
});

test("approved tool automations react to Cabinet events and leave receipts", async () => {
  await installCabinetTool(roomA, customTool);

  const outcomes = await applyCabinetToolEvent(roomA, {
    type: "task.completed",
    sourceId: "task-123",
    payload: { title: "Interview Acme" },
  });

  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0]?.automationId, "capture-completed-task");
  assert.equal(outcomes[0]?.status, "completed");
  assert.equal(
    (await getCabinetToolState(roomA, customTool.id)).collections.interviews.find(
      (record) => record.createdBy.type === "automation",
    )?.values.status,
    "complete",
  );
  assert.ok(
    (await listCabinetToolEvents(roomA, customTool.id)).some(
      (event) => event.type === "automation.completed",
    ),
  );
});

test("disabling a tool preserves its data while blocking agents and automations", async () => {
  await installCabinetTool(roomA, customTool);
  const before = await getCabinetToolState(roomA, customTool.id);
  await setCabinetToolEnabled(roomA, customTool.id, false);

  await assert.rejects(
    executeCabinetToolCommand(roomA, {
      type: "add-record",
      toolId: customTool.id,
      collectionId: "interviews",
      values: { customer: "Blocked", status: "planned" },
      actor: { type: "agent", id: "researcher" },
    }),
    /disabled/,
  );
  assert.deepEqual(
    await applyCabinetToolEvent(roomA, {
      type: "task.completed",
      sourceId: "disabled-task",
    }),
    [],
  );
  assert.equal(
    (await getCabinetToolState(roomA, customTool.id)).revision,
    before.revision,
  );
  await setCabinetToolEnabled(roomA, customTool.id, true);
});

test("event history reads only the requested valid tail from a large JSONL log", async () => {
  await installCabinetTool(roomA, customTool);
  const eventsFile = path.join(
    DATA_DIR,
    cabinetToolsDirectory(roomA),
    customTool.id,
    "events.jsonl",
  );
  const events = Array.from({ length: 520 }, (_, index) =>
    JSON.stringify({
      id: `tail-${index}`,
      toolId: customTool.id,
      type: "record.added",
      createdAt: new Date(1_700_000_000_000 + index).toISOString(),
      actor: { type: "user" },
      detail: { padding: "x".repeat(256) },
    }),
  );
  events.splice(519, 0, "not-json");
  await fs.appendFile(eventsFile, `${events.join("\n")}\n`, "utf8");

  assert.deepEqual(
    (await listCabinetToolEvents(roomA, customTool.id, 3)).map(
      (event) => event.id,
    ),
    ["tail-519", "tail-518", "tail-517"],
  );
});
