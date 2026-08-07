import {
  CABINET_TOOL_PERMISSIONS,
  type CabinetToolBlock,
  type CabinetToolEventType,
  type CabinetToolField as ManifestField,
  type CabinetToolIcon,
  type CabinetToolManifest,
  type CabinetToolPermission,
} from "@/types/tools";

export type CabinetToolBuilderFieldType = ManifestField["type"];

export interface CabinetToolBuilderField {
  key: string;
  label: string;
  type: CabinetToolBuilderFieldType;
  required: boolean;
  options: string[];
}

export interface CabinetToolBuilderViews {
  form: boolean;
  table: boolean;
  board: boolean;
  chart: boolean;
  metrics: boolean;
}

export interface CabinetToolBuilderDraft {
  name: string;
  description: string;
  icon: CabinetToolIcon;
  collectionName: string;
  fields: CabinetToolBuilderField[];
  views: CabinetToolBuilderViews;
  boardFieldKey: string;
  chartCategoryFieldKey: string;
  chartValueFieldKey: string;
  permissions: CabinetToolPermission[];
  starterLabel: string;
  starterPrompt: string;
  automationEnabled: boolean;
  automationEvent: CabinetToolEventType;
  automationPrompt: string;
}

export const CABINET_TOOL_BUILDER_PERMISSION_COPY: Record<
  CabinetToolPermission,
  { label: string; description: string }
> = {
  "knowledge:read": {
    label: "Read room knowledge",
    description: "Use the files and notes already in this Cabinet room.",
  },
  "knowledge:write": {
    label: "Update room knowledge",
    description: "Create or change files and notes in this Cabinet room.",
  },
  "agents:run": {
    label: "Run agents",
    description: "Let starter workflows hand work to your Cabinet agents.",
  },
  "tasks:manage": {
    label: "Manage tasks",
    description: "Create and update work in the room task board.",
  },
  "schedules:manage": {
    label: "Manage schedules",
    description: "Create or change scheduled work.",
  },
  "integrations:use": {
    label: "Use integrations",
    description: "Use connected services without exposing their API keys.",
  },
};

export const CABINET_TOOL_BUILDER_PERMISSIONS = [
  ...CABINET_TOOL_PERMISSIONS,
] as CabinetToolPermission[];

export function createInitialCabinetToolBuilderDraft(): CabinetToolBuilderDraft {
  return {
    name: "",
    description: "",
    icon: "workflow",
    collectionName: "Items",
    fields: [
      {
        key: "field-title",
        label: "Title",
        type: "text",
        required: true,
        options: [],
      },
      {
        key: "field-status",
        label: "Status",
        type: "select",
        required: true,
        options: ["Idea", "In progress", "Done"],
      },
      {
        key: "field-notes",
        label: "Notes",
        type: "textarea",
        required: false,
        options: [],
      },
    ],
    views: {
      form: true,
      table: true,
      board: true,
      chart: false,
      metrics: true,
    },
    boardFieldKey: "field-status",
    chartCategoryFieldKey: "field-status",
    chartValueFieldKey: "",
    permissions: ["knowledge:read", "agents:run"],
    starterLabel: "Plan the next steps",
    starterPrompt:
      "Review this tool and the room knowledge, then recommend the next three actions.",
    automationEnabled: false,
    automationEvent: "task.completed",
    automationPrompt: "",
  };
}

export function slugifyCabinetToolBuilderValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tool";
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function manifestFields(draft: CabinetToolBuilderDraft): {
  fields: ManifestField[];
  idsByKey: Map<string, string>;
} {
  const used = new Set<string>();
  const idsByKey = new Map<string, string>();
  const fields = draft.fields.map((field) => {
    const id = uniqueId(slugifyCabinetToolBuilderValue(field.label), used);
    idsByKey.set(field.key, id);
    const base: ManifestField = {
      id,
      label: field.label.trim(),
      type: field.type,
      required: field.required || undefined,
    };
    if (field.type === "select") {
      const optionIds = new Set<string>();
      base.options = field.options
        .map((option) => option.trim())
        .filter(Boolean)
        .map((option) => ({
          value: uniqueId(slugifyCabinetToolBuilderValue(option), optionIds),
          label: option,
        }));
    }
    return base;
  });
  return { fields, idsByKey };
}

function requireFieldId(
  idsByKey: Map<string, string>,
  key: string,
  view: string,
): string {
  const fieldId = idsByKey.get(key);
  if (!fieldId) {
    throw new Error(`${view} needs a compatible field.`);
  }
  return fieldId;
}

export function validateCabinetToolBuilderDraft(
  draft: CabinetToolBuilderDraft,
): void {
  if (!draft.name.trim()) throw new Error("Give your tool a name.");
  if (!draft.description.trim()) {
    throw new Error("Describe what this tool helps you accomplish.");
  }
  if (!draft.collectionName.trim()) {
    throw new Error("Name the information this tool will track.");
  }
  if (draft.fields.length === 0) {
    throw new Error("Add at least one field to your tool.");
  }
  for (const field of draft.fields) {
    if (!field.label.trim()) throw new Error("Every field needs a label.");
    if (
      field.type === "select" &&
      field.options.map((option) => option.trim()).filter(Boolean).length === 0
    ) {
      throw new Error(`${field.label.trim() || "A select field"} needs options.`);
    }
  }
  if (!Object.values(draft.views).some(Boolean)) {
    throw new Error("Choose at least one workspace view.");
  }
  const fieldByKey = new Map(draft.fields.map((field) => [field.key, field]));
  if (draft.views.board) {
    const groupField = fieldByKey.get(draft.boardFieldKey);
    if (!groupField || groupField.type !== "select") {
      throw new Error("The board view needs a select field for its columns.");
    }
  }
  if (draft.views.chart) {
    const valueField = fieldByKey.get(draft.chartValueFieldKey);
    if (!fieldByKey.has(draft.chartCategoryFieldKey)) {
      throw new Error("The chart view needs a category field.");
    }
    if (!valueField || valueField.type !== "number") {
      throw new Error("The chart view needs a number field to measure.");
    }
  }
  if (draft.automationEnabled && !draft.automationPrompt.trim()) {
    throw new Error("Describe what the automation should ask an agent to do.");
  }
}

export function createCabinetToolManifestFromDraft(
  draft: CabinetToolBuilderDraft,
  existingIds: Iterable<string> = [],
): CabinetToolManifest {
  validateCabinetToolBuilderDraft(draft);
  const usedToolIds = new Set(existingIds);
  const toolId = uniqueId(
    slugifyCabinetToolBuilderValue(draft.name),
    usedToolIds,
  );
  const { fields, idsByKey } = manifestFields(draft);
  const allFieldIds = fields.map((field) => field.id);
  const titleField =
    fields.find((field) => field.type === "text")?.id ?? fields[0].id;
  const collectionId = slugifyCabinetToolBuilderValue(draft.collectionName);
  const blocks: CabinetToolBlock[] = [];

  if (draft.views.metrics) {
    blocks.push({
      id: "total-items",
      type: "metric",
      title: `Total ${draft.collectionName.trim().toLowerCase()}`,
      collectionId,
      calculation: "count",
    });
    const numberField = fields.find((field) => field.type === "number");
    if (numberField) {
      blocks.push({
        id: `total-${numberField.id}`,
        type: "metric",
        title: `Total ${numberField.label}`,
        collectionId,
        calculation: "sum",
        valueField: numberField.id,
      });
    }
  }
  if (draft.views.form) {
    blocks.push({
      id: "add-item",
      type: "form",
      title: `Add to ${draft.collectionName.trim()}`,
      description: "Capture a new entry.",
      collectionId,
      fields: allFieldIds,
      actionLabel: "Add",
    });
  }
  if (draft.views.board) {
    const groupBy = requireFieldId(idsByKey, draft.boardFieldKey, "Board view");
    const groupField = fields.find((field) => field.id === groupBy);
    blocks.push({
      id: "workflow-board",
      type: "board",
      title: `${draft.collectionName.trim()} board`,
      collectionId,
      titleField,
      groupBy,
      lanes: (groupField?.options ?? []).map((option) => ({
        value: option.value,
        label: option.label,
      })),
    });
  }
  if (draft.views.table) {
    blocks.push({
      id: "all-items",
      type: "table",
      title: `All ${draft.collectionName.trim().toLowerCase()}`,
      collectionId,
      fields: allFieldIds,
    });
  }
  if (draft.views.chart) {
    blocks.push({
      id: "summary-chart",
      type: "chart",
      title: `${draft.collectionName.trim()} overview`,
      collectionId,
      chartType: "bar",
      categoryField: requireFieldId(
        idsByKey,
        draft.chartCategoryFieldKey,
        "Chart view",
      ),
      valueField: requireFieldId(
        idsByKey,
        draft.chartValueFieldKey,
        "Chart view",
      ),
    });
  }

  const starterPrompts = draft.starterPrompt.trim()
    ? [
        {
          id: "start-work",
          label: draft.starterLabel.trim() || "Start working",
          prompt: draft.starterPrompt.trim(),
        },
      ]
    : [];

  return {
    schemaVersion: 1,
    id: toolId,
    version: "1.0.0",
    name: draft.name.trim(),
    description: draft.description.trim(),
    icon: draft.icon,
    permissions: Array.from(new Set(draft.permissions)),
    surfaces: {
      home: {
        title: draft.name.trim(),
        description: draft.description.trim(),
      },
      workspace: {
        title: draft.name.trim(),
        description: draft.description.trim(),
        starterPrompts,
        blocks,
      },
    },
    collections: [
      {
        id: collectionId,
        name: draft.collectionName.trim(),
        fields,
      },
    ],
    automations: draft.automationEnabled
      ? [
          {
            id: "follow-up",
            name: "Agent follow-up",
            event: draft.automationEvent,
            action: {
              type: "queue-prompt",
              prompt: draft.automationPrompt.trim(),
            },
          },
        ]
      : [],
  };
}
