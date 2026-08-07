import {
  CABINET_TOOL_PERMISSIONS,
  CABINET_TOOL_SCHEMA_VERSION,
  type CabinetToolBlock,
  type CabinetToolManifest,
  type CabinetToolPermission,
} from "@/types/tools";

export const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/;
const STARTER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const FIELD_ID_PATTERN = STARTER_ID_PATTERN;
const ALLOWED_PERMISSIONS = new Set<string>(CABINET_TOOL_PERMISSIONS);
const ALLOWED_ICONS = new Set([
  "book-open",
  "briefcase",
  "chart",
  "list-checks",
  "search",
  "sparkles",
  "workflow",
]);
const ALLOWED_FIELD_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "date",
]);
const ALLOWED_BLOCK_TYPES = new Set([
  "form",
  "table",
  "board",
  "chart",
  "metric",
]);
export const ALLOWED_EVENT_TYPES = new Set([
  "conversation.completed",
  "task.completed",
  "knowledge.changed",
  "schedule.fired",
  "integration.received",
]);

function cloneManifest(manifest: CabinetToolManifest): CabinetToolManifest {
  return JSON.parse(JSON.stringify(manifest)) as CabinetToolManifest;
}

export function assertNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Cabinet Tool ${field} must be a non-empty string.`);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertIdentifier(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);
  if (!FIELD_ID_PATTERN.test(value)) {
    throw new Error(`Cabinet Tool ${field} must use lowercase words separated by hyphens.`);
  }
}

function validateDataModel(manifest: Partial<CabinetToolManifest>): void {
  const collections = manifest.collections ?? [];
  if (!Array.isArray(collections)) {
    throw new Error("Cabinet Tool collections must be an array.");
  }
  const collectionFields = new Map<string, Set<string>>();
  for (const collection of collections) {
    assertIdentifier(collection?.id, "collection id");
    if (collectionFields.has(collection.id)) {
      throw new Error(`Duplicate Cabinet Tool collection id: ${collection.id}.`);
    }
    assertNonEmptyString(collection.name, "collection name");
    if (!Array.isArray(collection.fields) || collection.fields.length === 0) {
      throw new Error(`Cabinet Tool collection ${collection.id} must declare fields.`);
    }
    const fields = new Set<string>();
    for (const field of collection.fields) {
      assertIdentifier(field?.id, "field id");
      if (fields.has(field.id)) {
        throw new Error(`Duplicate field ${field.id} in collection ${collection.id}.`);
      }
      fields.add(field.id);
      assertNonEmptyString(field.label, "field label");
      if (!ALLOWED_FIELD_TYPES.has(String(field.type))) {
        throw new Error(`Unsupported Cabinet Tool field type: ${String(field.type)}.`);
      }
      if (field.placeholder !== undefined) {
        assertNonEmptyString(field.placeholder, "field placeholder");
      }
      if (field.type === "select") {
        if (!Array.isArray(field.options) || field.options.length === 0) {
          throw new Error(`Select field ${field.id} must declare options.`);
        }
        const values = new Set<string>();
        for (const option of field.options) {
          assertNonEmptyString(option?.value, "select option value");
          assertNonEmptyString(option.label, "select option label");
          if (values.has(option.value)) {
            throw new Error(`Duplicate option ${option.value} in field ${field.id}.`);
          }
          values.add(option.value);
        }
      } else if (field.options !== undefined) {
        throw new Error(`Only select fields may declare options (${field.id}).`);
      }
    }
    collectionFields.set(collection.id, fields);
  }

  const blocks = manifest.surfaces?.workspace?.blocks ?? [];
  if (!Array.isArray(blocks)) {
    throw new Error("Cabinet Tool workspace blocks must be an array.");
  }
  const blockIds = new Set<string>();
  for (const block of blocks as CabinetToolBlock[]) {
    assertIdentifier(block?.id, "workspace block id");
    if (blockIds.has(block.id)) {
      throw new Error(`Duplicate Cabinet Tool workspace block id: ${block.id}.`);
    }
    blockIds.add(block.id);
    assertNonEmptyString(block.title, "workspace block title");
    if (!ALLOWED_BLOCK_TYPES.has(String(block.type))) {
      throw new Error(`Unsupported Cabinet Tool block type: ${String(block.type)}.`);
    }
    assertIdentifier(block.collectionId, "workspace block collectionId");
    const fields = collectionFields.get(block.collectionId);
    if (!fields) {
      throw new Error(`Workspace block ${block.id} references an unknown collection.`);
    }
    const requireField = (fieldId: unknown, label: string) => {
      assertIdentifier(fieldId, label);
      if (!fields.has(fieldId)) {
        throw new Error(`Workspace block ${block.id} references unknown field ${fieldId}.`);
      }
    };
    if (block.type === "form" || block.type === "table") {
      if (!Array.isArray(block.fields) || block.fields.length === 0) {
        throw new Error(`Workspace block ${block.id} must declare fields.`);
      }
      for (const fieldId of block.fields) requireField(fieldId, "block field");
    } else if (block.type === "board") {
      requireField(block.titleField, "board titleField");
      requireField(block.groupBy, "board groupBy");
      if (!Array.isArray(block.lanes) || block.lanes.length === 0) {
        throw new Error(`Board ${block.id} must declare lanes.`);
      }
      for (const lane of block.lanes) {
        assertNonEmptyString(lane?.value, "board lane value");
        assertNonEmptyString(lane.label, "board lane label");
      }
    } else if (block.type === "chart") {
      if (!new Set(["bar", "line", "donut"]).has(block.chartType)) {
        throw new Error(`Unsupported chart type: ${String(block.chartType)}.`);
      }
      requireField(block.categoryField, "chart categoryField");
      requireField(block.valueField, "chart valueField");
    } else if (block.type === "metric") {
      if (!new Set(["count", "sum", "average"]).has(block.calculation)) {
        throw new Error(`Unsupported metric calculation: ${String(block.calculation)}.`);
      }
      if (block.calculation !== "count") {
        requireField(block.valueField, "metric valueField");
      }
    }
  }

  const automations = manifest.automations ?? [];
  if (!Array.isArray(automations)) {
    throw new Error("Cabinet Tool automations must be an array.");
  }
  const automationIds = new Set<string>();
  for (const automation of automations) {
    assertIdentifier(automation?.id, "automation id");
    if (automationIds.has(automation.id)) {
      throw new Error(`Duplicate Cabinet Tool automation id: ${automation.id}.`);
    }
    automationIds.add(automation.id);
    assertNonEmptyString(automation.name, "automation name");
    if (!ALLOWED_EVENT_TYPES.has(String(automation.event))) {
      throw new Error(`Unsupported Cabinet Tool event: ${String(automation.event)}.`);
    }
    if (!isRecord(automation.action)) {
      throw new Error(`Automation ${automation.id} must declare an action.`);
    }
    const actionType = (automation.action as { type?: unknown }).type;
    if (automation.action.type === "add-record") {
      assertIdentifier(automation.action.collectionId, "automation collectionId");
      if (!collectionFields.has(automation.action.collectionId)) {
        throw new Error(`Automation ${automation.id} references an unknown collection.`);
      }
      if (!isRecord(automation.action.values)) {
        throw new Error(`Automation ${automation.id} values must be an object.`);
      }
    } else if (automation.action.type === "queue-prompt") {
      assertNonEmptyString(automation.action.prompt, "automation prompt");
    } else {
      throw new Error(`Unsupported Cabinet Tool automation action: ${String(actionType)}.`);
    }
  }
}

/** Validate untrusted, agent-authored manifests before they reach storage or UI. */
export function validateCabinetToolManifest(
  value: unknown,
): CabinetToolManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cabinet Tool manifest must be an object.");
  }
  const manifest = value as Partial<CabinetToolManifest>;
  if (manifest.schemaVersion !== CABINET_TOOL_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported Cabinet Tool schema version: ${String(manifest.schemaVersion)}.`,
    );
  }
  assertNonEmptyString(manifest.id, "id");
  if (!TOOL_ID_PATTERN.test(manifest.id)) {
    throw new Error(
      "Cabinet Tool id must use lowercase words separated by hyphens.",
    );
  }
  assertNonEmptyString(manifest.version, "version");
  if (!VERSION_PATTERN.test(manifest.version)) {
    throw new Error(
      "Cabinet Tool version must use semantic versioning, such as 1.0.0.",
    );
  }
  assertNonEmptyString(manifest.name, "name");
  assertNonEmptyString(manifest.description, "description");
  if (!ALLOWED_ICONS.has(String(manifest.icon))) {
    throw new Error(`Unsupported Cabinet Tool icon: ${String(manifest.icon)}.`);
  }
  if (!Array.isArray(manifest.permissions)) {
    throw new Error("Cabinet Tool permissions must be an array.");
  }
  const permissions = new Set<CabinetToolPermission>();
  for (const permission of manifest.permissions) {
    if (!ALLOWED_PERMISSIONS.has(String(permission))) {
      throw new Error(
        `Unsupported Cabinet Tool permission: ${String(permission)}.`,
      );
    }
    permissions.add(permission);
  }

  const surfaces = manifest.surfaces;
  if (!surfaces || typeof surfaces !== "object") {
    throw new Error("Cabinet Tool surfaces must be declared.");
  }
  if (!surfaces.home && !surfaces.workspace) {
    throw new Error("Cabinet Tool must declare at least one surface.");
  }
  if (surfaces.home) {
    assertNonEmptyString(surfaces.home.title, "home title");
    assertNonEmptyString(surfaces.home.description, "home description");
    if (surfaces.home.actionLabel !== undefined) {
      assertNonEmptyString(surfaces.home.actionLabel, "home action label");
    }
  }
  if (surfaces.workspace) {
    assertNonEmptyString(surfaces.workspace.title, "workspace title");
    assertNonEmptyString(
      surfaces.workspace.description,
      "workspace description",
    );
    if (!Array.isArray(surfaces.workspace.starterPrompts)) {
      throw new Error(
        "Cabinet Tool workspace starterPrompts must be an array.",
      );
    }
    const promptIds = new Set<string>();
    for (const starter of surfaces.workspace.starterPrompts) {
      assertNonEmptyString(starter?.id, "starter prompt id");
      if (!STARTER_ID_PATTERN.test(starter.id) || promptIds.has(starter.id)) {
        throw new Error(
          `Cabinet Tool starter prompt id is invalid or duplicated: ${starter.id}.`,
        );
      }
      promptIds.add(starter.id);
      assertNonEmptyString(starter.label, "starter prompt label");
      assertNonEmptyString(starter.prompt, "starter prompt");
      if (starter.description !== undefined) {
        assertNonEmptyString(starter.description, "starter prompt description");
      }
    }
  }

  validateDataModel(manifest);

  return cloneManifest({
    ...manifest,
    permissions: Array.from(permissions),
  } as CabinetToolManifest);
}
