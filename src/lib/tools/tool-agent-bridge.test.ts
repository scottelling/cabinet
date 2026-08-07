import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { executeCabinetAgentTool } from "@/lib/tools/tool-agent-bridge";
import {
  getCabinetToolInventory,
  getCabinetToolState,
  installCabinetTool,
} from "@/lib/tools/tool-platform";
import { DATA_DIR } from "@/lib/storage/path-utils";
import type { CabinetToolManifest } from "@/types/tools";

const cabinetPath = "tool-agent-bridge-room";
const manifest: CabinetToolManifest = {
  schemaVersion: 1,
  id: "content-calendar",
  version: "1.0.0",
  name: "Content Calendar",
  description: "Plan and track content.",
  icon: "chart",
  permissions: ["knowledge:read", "agents:run"],
  surfaces: {
    home: { title: "Content Calendar", description: "Track content." },
    workspace: {
      title: "Content Calendar",
      description: "Plan content with your team.",
      starterPrompts: [],
      blocks: [
        {
          id: "content-table",
          type: "table",
          title: "Content",
          collectionId: "content",
          fields: ["title", "status"],
        },
      ],
    },
  },
  collections: [
    {
      id: "content",
      name: "Content",
      fields: [
        { id: "title", label: "Title", type: "text", required: true },
        {
          id: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "idea", label: "Idea" },
            { value: "published", label: "Published" },
          ],
        },
      ],
    },
  ],
};

test.before(async () => {
  const directory = path.join(DATA_DIR, cabinetPath);
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, ".cabinet"), "kind: room\nname: Bridge Room\n");
  await installCabinetTool(cabinetPath, manifest);
});

test.after(async () => {
  await fs.rm(path.join(DATA_DIR, cabinetPath), { recursive: true, force: true });
});

test("an agent can discover and inspect installed tools during a conversation", async () => {
  const listed = JSON.parse(
    await executeCabinetAgentTool(cabinetPath, "list_cabinet_tools", {}),
  ) as { tools: Array<{ id: string; openPath: string }> };

  assert.deepEqual(
    listed.tools.map((tool) => tool.id),
    ["content-calendar"],
  );
  assert.equal(
    listed.tools[0]?.openPath,
    "/room/tool-agent-bridge-room/-/tools/content-calendar",
  );

  const inspected = JSON.parse(
    await executeCabinetAgentTool(cabinetPath, "use_cabinet_tool", {
      action: "inspect",
      toolId: "content-calendar",
    }),
  ) as { state: { revision: number }; manifest: { name: string } };
  assert.equal(inspected.manifest.name, "Content Calendar");
  assert.equal(inspected.state.revision, 0);
});

test("an agent can add a record through an installed tool", async () => {
  const result = JSON.parse(
    await executeCabinetAgentTool(cabinetPath, "use_cabinet_tool", {
      action: "add-record",
      toolId: "content-calendar",
      collectionId: "content",
      values: { title: "Launch story", status: "idea" },
    }),
  ) as { record: { values: { title: string } }; revision: number };

  assert.equal(result.record.values.title, "Launch story");
  assert.equal(result.revision, 1);
  assert.equal(
    (await getCabinetToolState(cabinetPath, "content-calendar")).collections.content[0]
      ?.createdBy.type,
    "agent",
  );
});

test("an agent can propose but not silently apply a change to an installed tool", async () => {
  const updated: CabinetToolManifest = {
    ...manifest,
    version: "1.1.0",
    name: "Editorial Calendar",
  };

  const result = JSON.parse(
    await executeCabinetAgentTool(cabinetPath, "propose_cabinet_tool_change", {
      toolId: manifest.id,
      manifest: updated,
      reason: "The team now uses this for the full editorial workflow.",
    }),
  ) as { proposal: { kind: string; baseVersion: string } };

  assert.equal(result.proposal.kind, "update");
  assert.equal(result.proposal.baseVersion, "1.0.0");
  const inventory = await getCabinetToolInventory(cabinetPath);
  assert.equal(inventory.installed[0]?.manifest.name, "Content Calendar");
  assert.equal(inventory.proposals[0]?.manifest.name, "Editorial Calendar");
});
