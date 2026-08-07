import assert from "node:assert/strict";
import test from "node:test";
import {
  createCabinetToolManifestFromDraft,
  createInitialCabinetToolBuilderDraft,
  validateCabinetToolBuilderDraft,
} from "@/lib/tools/tool-builder";
import { validateCabinetToolManifest } from "@/lib/tools/tool-manifest";

test("the visual builder creates a complete stateful Cabinet Tool manifest", () => {
  const draft = createInitialCabinetToolBuilderDraft();
  draft.name = "Launch Planner";
  draft.description = "Plan a launch, move work through review, and measure reach.";
  draft.collectionName = "Launch items";
  draft.fields.push({
    key: "field-reach",
    label: "Estimated reach",
    type: "number",
    required: false,
    options: [],
  });
  draft.views.chart = true;
  draft.chartCategoryFieldKey = "field-status";
  draft.chartValueFieldKey = "field-reach";
  draft.automationEnabled = true;
  draft.automationPrompt = "Review the completed task and update the launch plan.";

  const manifest = createCabinetToolManifestFromDraft(draft);
  assert.equal(manifest.id, "launch-planner");
  assert.equal(manifest.collections?.[0]?.id, "launch-items");
  assert.deepEqual(
    manifest.surfaces.workspace?.blocks?.map((block) => block.type),
    ["metric", "metric", "form", "board", "table", "chart"],
  );
  assert.deepEqual(manifest.automations?.map((automation) => automation.event), [
    "task.completed",
  ]);
  assert.doesNotThrow(() => validateCabinetToolManifest(manifest));
});

test("the visual builder keeps generated ids valid and avoids installed tool ids", () => {
  const draft = createInitialCabinetToolBuilderDraft();
  draft.name = "Client & Partner Tracker";
  draft.description = "Keep client work organized.";
  draft.fields[0].label = "Client / Partner";
  draft.fields[1].options = ["In review", "In review", "Won!"];

  const manifest = createCabinetToolManifestFromDraft(draft, [
    "client-partner-tracker",
  ]);
  assert.equal(manifest.id, "client-partner-tracker-2");
  assert.equal(manifest.collections?.[0]?.fields[0]?.id, "client-partner");
  assert.deepEqual(
    manifest.collections?.[0]?.fields[1]?.options?.map((option) => option.value),
    ["in-review", "in-review-2", "won"],
  );
  assert.doesNotThrow(() => validateCabinetToolManifest(manifest));
});

test("the visual builder explains missing view requirements before install", () => {
  const draft = createInitialCabinetToolBuilderDraft();
  draft.name = "Simple List";
  draft.description = "Track a simple list.";
  draft.fields = draft.fields.filter((field) => field.type !== "select");

  assert.throws(
    () => validateCabinetToolBuilderDraft(draft),
    /board view needs a select field/i,
  );
});
